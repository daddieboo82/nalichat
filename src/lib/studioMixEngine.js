// Realtime mixer/FX engine for the Studio.
//
// Playback is driven by plain <audio> elements (they give us cheap scrubbing and
// transport sync). This engine taps each element with a MediaElementAudioSource and
// runs it through the exact same channel strip the offline bounce uses
// (fader -> inserts -> pan -> Send 1 -> master FX -> master fader), so the mixer
// and the export stay in sync.
//
// If the Web Audio graph can't be used for an element (cross-origin media without
// CORS headers, or a browser that refuses createMediaElementSource) the engine
// reports failure for that track and the caller falls back to element volume only.

import { planVoxWorkload } from './voxSpectralBudget.js';
import { voxPitchRatio, voxPitchRate } from '@/lib/voxShift';
import { studioFxStructureChanged } from '@/lib/studioFxStructure';
import {
  connectMasterChain,
  connectTrackChain,
  trackGainValue,
  automatedTrackState,
  studioEqCompTargets,
  getTrackEffects,
} from '@/lib/audioProcessing';

const isSameOriginUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

export function needsCrossOrigin(url) {
  return !!url && !isSameOriginUrl(url);
}

function disposeNode(node) {
  // VoxShift uses looping modulation sources that must stop when the graph is rebuilt.
  try { node.stop?.(); } catch { /* already stopped */ }
  try { node.disconnect(); } catch { /* already disconnected */ }
}

function liveInsertTargets(fx, sampleRate) {
  const rate = voxPitchRate(fx?.voxshift?.params, sampleRate);
  return {...studioEqCompTargets(fx), voxPitch0: rate, voxPitch1: rate};
}

function canUpdateLiveInserts(beforeFx, afterFx, liveParams = {}) {
  const beforeRatio = voxPitchRatio(beforeFx.voxshift?.params);
  const afterRatio = voxPitchRatio(afterFx.voxshift?.params);
  const canSlidePitch = !!(liveParams.voxPitch0 && liveParams.voxPitch1) &&
    Math.sign(beforeRatio - 1) === Math.sign(afterRatio - 1) && beforeRatio !== 1;

  const strip = fx => {
    const copy = {...fx};
    for (const key of ['eq','comp','delay']) {
      if (copy[key]) {
        const {params, ...rest} = copy[key];
        copy[key] = rest;
      }
    }
    if (copy.reverb?.params && !Array.isArray(copy.reverb.params)) {
      const {Mix, ...params} = copy.reverb.params;
      copy.reverb = {...copy.reverb, params};
    }
    if (copy.voxshift?.params && !Array.isArray(copy.voxshift.params)) {
      const {Output, ...params} = copy.voxshift.params;
      if (canSlidePitch) delete params.Pitch;
      copy.voxshift = {...copy.voxshift, params};
    }
    return copy;
  };
  const handlesReady = (!afterFx.eq || afterFx.eq.enabled === false ||
    ['low','mid','high'].every(key => liveParams[key])) &&
    (!afterFx.comp || afterFx.comp.enabled === false ||
    ['threshold','ratio','makeup'].every(key => liveParams[key])) &&
    (!afterFx.delay || afterFx.delay.enabled === false ||
    ['delayMix','delayTime','delayFeedback'].every(key => liveParams[key])) &&
    (!afterFx.reverb || afterFx.reverb.enabled === false ||
    ['reverbWet','reverbDry'].every(key => liveParams[key])) &&
    (!afterFx.voxshift || afterFx.voxshift.enabled === false || liveParams.voxOutput);
  return handlesReady && JSON.stringify(strip(beforeFx)) === JSON.stringify(strip(afterFx));
}

export function createMixEngine() {
  let context = null;
  let master = null;
  let masterMeter = null;
  let masterClipped = false;
  let masterInterSample = false;
  let masterLoudness = null;
  let clipMonitor = null;
  let clipModule = null;
  const attachClipMonitor = () => {
    const ctx = context, bus = master;
    if (!ctx?.audioWorklet || typeof globalThis.AudioWorkletNode !== 'function' || !bus) return;
    if (!clipModule) clipModule = ctx.audioWorklet.addModule('/audio/nali-master-clip-monitor.worklet.js?v=2');
    clipModule.then(() => {
      if (disposed || context !== ctx || master !== bus || clipMonitor) return;
      let node, silent;
      try {
        node = new globalThis.AudioWorkletNode(ctx, 'nali-master-clip-monitor', {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{estimateInterSample:true}});
        silent = ctx.createGain();
        silent.gain.value = 0;
        node.connect(silent);
        silent.connect(ctx.destination);
        node.port.onmessage = event => {
          if (clipMonitor !== node) return;
          const data = event.data;
          if (data === 'clip') masterClipped = true;
          if (data === 'inter-sample') masterInterSample = true;
          if (data?.type === 'loudness') {
            masterLoudness = {
              momentary: Number.isFinite(data.momentary) ? data.momentary : null,
              shortTerm: Number.isFinite(data.shortTerm) ? data.shortTerm : null,
            };
          }
        };
        bus.volume.connect(node);
        bus.nodes.push(node,silent);
        clipMonitor = node;
      } catch { if (node) disposeNode(node); if (silent) disposeNode(silent); }
    }).catch(() => {});
  };

  let masterState = { masterVolume: 100, masterFx: null };
  const entries = new Map(); // trackId -> { element, source, nodes }
  let disposed = false;
  let spectralRoutes = null, spectralEpoch = 0, spectralStatus = {status:'inactive'};
  const releaseSpectral = () => {
    spectralEpoch++;
    const old=spectralRoutes;spectralRoutes=null;
    if(old)for(const route of old.values())try{route.processor?.dispose();}catch{/* already released */}
    return !!old;
  };
  const invalidateSpectral = reason => {
    const active=releaseSpectral();
    if(active || spectralStatus.status==='preparing') spectralStatus={status:'invalidated',reason};
    if(active)entries.forEach((entry,id)=>rebuild(id,entry.track,entry.gain));
  };

  const buildMaster = () => {
    if (!context) return;
    if (master) {
      invalidateSpectral("master rebuild");
      master.nodes.forEach(disposeNode);
    }
    master = connectMasterChain(context, {
      masterFx: masterState.masterFx,
      masterVolume: masterState.masterVolume,
      destination: context.destination,
    });
    masterMeter = null;
    masterLoudness = null;
    clipMonitor = null;
    attachClipMonitor();
    // Tap the actual post-fader signal without modifying the audible route.
    if (typeof context.createAnalyser === 'function' && typeof context.createChannelSplitter === 'function') {
      const nodes = [];
      try {
        const splitter = context.createChannelSplitter(2);
        nodes.push(splitter);
        const analysers = [0, 1].map(channel => {
          const analyser = context.createAnalyser();
          nodes.push(analyser);
          analyser.fftSize = context.sampleRate > 96000 ? 16384 : context.sampleRate > 48000 ? 8192 : 4096;
          splitter.connect(analyser, channel);
          return analyser;
        });
        if (analysers.every(node => typeof node.getFloatTimeDomainData === 'function')) {
          master.volume.connect(splitter);
          master.nodes.push(...nodes);
          masterMeter = {analysers, samples: new Float32Array(analysers[0].fftSize)};
        } else nodes.forEach(disposeNode);
      } catch { nodes.forEach(disposeNode); }
    }
    // Re-attach every live channel strip to the rebuilt master bus.
    entries.forEach((entry, trackId) => {
      if (entry.track) rebuild(trackId, entry.track, entry.gain);
    });
  };

  // Allocate continuous monitors only for displayed channel meters.
  const attachTrackClipMonitor = (entry, meter) => {
    const ctx = context, output = entry.meterOutput;
    if (!clipModule || !ctx || !output || meter.clipPending || meter.clipNode) return;
    meter.clipPending = true;
    clipModule.then(() => {
      if (disposed || context !== ctx || entry.meter !== meter || entry.meterOutput !== output) return;
      let node, silent;
      try {
        node = new globalThis.AudioWorkletNode(ctx, 'nali-master-clip-monitor', {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
        silent = ctx.createGain();
        silent.gain.value = 0;
        node.connect(silent);
        silent.connect(ctx.destination);
        node.port.onmessage = event => {
          if (entry.meter === meter && meter.clipNode === node && event.data === 'clip') entry.clipped = true;
        };
        output.connect(node);
        meter.clipNode = node;
        meter.clipSilent = silent;
        entry.nodes.push(node,silent);
      } catch { if (node) disposeNode(node); if (silent) disposeNode(silent); }
    }).catch(() => {});
  };

  const teardownEntry = (entry) => {
    entry.meter = null;
    entry.meterOutput = null;
    entry.nodes?.forEach(disposeNode);
    entry.nodes = [];
    try { entry.source?.disconnect(); } catch { /* already gone */ }
  };

  const rebuild = (trackId, track, gain) => {
    const entry = entries.get(trackId);
    if (!entry || !context || !master) return;
    teardownEntry(entry);
    // Retained processors must not keep output edges into the retired strip.
    spectralRoutes?.get(trackId)?.processor?.node.disconnect();
    const built = connectTrackChain(context, entry.source, track, {
      destination: master.input,
      reverbBus: master.reverbBus,
      delayBus: master.delayBus,
      cueBus: master.cueBus,
      gain,
      spectralRoute: spectralRoutes?.get(trackId),
    });
    entry.nodes = built.nodes;
    entry.trackGain = built.trackGain;
    entry.sendGains = built.sendGains;
    entry.track = track;
    entry.gain = gain;
    entry.panner = built.nodes.find(n => n && n.pan);
    entry.parameterTargets = new Map();
    entry.liveParams = built.liveParams || {};
    entry.meter = null;
    entry.meterOutput = built.output;

  };

  return {
    // Experimental: call only with all session media attached and paused.
    // No automatic activation; changes that invalidate the fixed graph restore
    // legacy routing and expose an explicit status to the transport caller.
    async prepareSpectralPlayback({createNode, reserve=0.5}={}) {
      if(disposed || !context || !master)return {status:'unavailable'};
      if([...entries.values()].some(e=>!e.element.paused))return {status:'playing'};
      invalidateSpectral('reconfigure');
      const epoch=++spectralEpoch,ctx=context;
      const snapshot=[...entries.entries()];
      const plan=planVoxWorkload(snapshot.map(([id,e])=>{
        const fx=getTrackEffects(e.track).voxshift;
        return {id,channels:2,ratio:fx&&fx.enabled!==false?voxPitchRatio(fx.params):1};
      }),{sampleRate:ctx.sampleRate,reserve});
      const deferred=plan.tracks.filter(t=>t.status==='deferred').map(t=>t.id);
      if(deferred.length)return spectralStatus={status:'deferred',deferred,plan};
      const routes=new Map();spectralStatus={status:'preparing'};
      try {
        const factory=createNode || (await import('./voxSpectralWorklet.js')).createVoxSpectralNode;
        for(const t of plan.tracks){
          const route={delaySamples:t.delaySamples,processor:null};routes.set(t.id,route);
          if(t.mode){const e=entries.get(t.id);if(!e)throw Error('Track removed');route.processor=await factory(ctx,{mode:t.mode,ratio:voxPitchRatio(getTrackEffects(e.track).voxshift.params),channels:2});if(route.processor.latencySamples!==t.latencySamples)throw Error('Unexpected processor latency');}
          if(epoch!==spectralEpoch || disposed || ctx!==context)throw Error('Preparation superseded');
        }
        if(snapshot.some(([id,e])=>entries.get(id)!==e || !e.element.paused))throw Error('Session changed during preparation');
        spectralRoutes=routes;
        entries.forEach((e,id)=>rebuild(id,e.track,e.gain));
        return spectralStatus={status:'ready',plan};
      }catch(error){
        if(spectralRoutes===routes){releaseSpectral();entries.forEach((e,id)=>rebuild(id,e.track,e.gain));return spectralStatus={status:'failed',reason:error.message};}
        else for(const route of routes.values())try{route.processor?.dispose();}catch{/* released */}
        if(epoch===spectralEpoch)return spectralStatus={status:'failed',reason:error.message};
        return {status:'invalidated',reason:error.message};
      }
    },
    // Paused-only reset: rebuild native delay buffers and await DSP reset ACKs.
    // The transport must pause sources before calling, then seek and resume.
    async refreshSpectralPlayback() {
      if(!spectralRoutes || spectralStatus.status!=='ready')return {status:'unavailable'};
      if([...entries.values()].some(e=>!e.element.paused))return {status:'playing'};
      const routes=spectralRoutes,epoch=++spectralEpoch,plan=spectralStatus.plan;
      spectralStatus={status:'resetting',plan};
      try {
        // Disconnect source and output edges while the processor clears history.
        for(const [id,e] of entries){teardownEntry(e);routes.get(id)?.processor?.node.disconnect();}
        await Promise.all([...routes.values()].map(r=>r.processor ? r.processor.reset() : Promise.resolve()));
        if(epoch!==spectralEpoch || routes!==spectralRoutes || disposed)return {status:'invalidated'};
        if([...entries.values()].some(e=>!e.element.paused))throw Error('Playback resumed before reset completed');
        entries.forEach((e,id)=>rebuild(id,e.track,e.gain));
        return spectralStatus={status:'ready',plan};
      }catch(error){
        if(epoch!==spectralEpoch || routes!==spectralRoutes || disposed)return {status:'invalidated'};
        invalidateSpectral('reset failed');
        return spectralStatus={status:'failed',reason:error.message};
      }
    },
    playbackLatencySnapshot(){
      const ready=spectralStatus.status==='ready' && !!spectralRoutes;
      const known=ready || !['preparing','resetting'].includes(spectralStatus.status);
      return {known:!!context && known,epoch:spectralEpoch,
        algorithmicSeconds:ready?spectralStatus.plan.latencySamples/context.sampleRate:0,
        outputLatencyMs:Number.isFinite(context?.outputLatency)?context.outputLatency*1000:null};
    },
    spectralPlaybackStatus(){return spectralStatus;},
    resetSpectralPlayback(){invalidateSpectral('transport reset');return spectralStatus;},
    /** Lazily create the AudioContext. Must be called from a user gesture. */
    ensureContext() {
      if (disposed) return null;
      if (!context) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        try {
          context = new Ctor({ latencyHint: 'interactive' });
        } catch (e) {
          console.error('Studio mixer: could not create AudioContext', e);
          context = null;
          return null;
        }
        buildMaster();
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    },

    // Create taps only for channels actually displayed in the mixer.
    releaseTrackMeters() {
      entries.forEach(entry => {
        const meter = entry.meter;
        if (!meter) return;
        // Disconnect only the monitoring branch, never the audible output.
        try { entry.meterOutput.disconnect(meter.splitter); }
        catch { return; } // Keep ownership for normal graph teardown.
        const nodes = [meter.splitter, ...meter.analysers];
        if (meter.clipNode) {
          // If targeted disconnect is unsupported, silence and keep ownership
          // until ordinary graph teardown, rather than disconnecting audio.
          try {
            entry.meterOutput.disconnect(meter.clipNode);
            nodes.push(meter.clipNode, meter.clipSilent);
          } catch {
            meter.clipNode.port.onmessage = null;
            disposeNode(meter.clipNode);
            disposeNode(meter.clipSilent);
          }
        }
        nodes.forEach(disposeNode);
        entry.nodes = entry.nodes.filter(node => !nodes.includes(node));
        entry.meter = null;
      });
    },

    readTrackPeak(trackId) {
      const entry = entries.get(trackId);
      if (!entry?.meterOutput || context?.state !== 'running' ||
          !context.createAnalyser || !context.createChannelSplitter) return null;
      if (!entry.meter) {
        const nodes = [];
        try {
          const splitter = context.createChannelSplitter(2);
          nodes.push(splitter);
          const analysers = [0, 1].map(channel => {
            const analyser = context.createAnalyser();
            nodes.push(analyser);
            analyser.fftSize = context.sampleRate > 96000 ? 16384 : context.sampleRate > 48000 ? 8192 : 4096;
            splitter.connect(analyser, channel);
            return analyser;
          });
          if (!analysers.every(node => typeof node.getFloatTimeDomainData === 'function')) {
            nodes.forEach(disposeNode);
            return null;
          }
          const samples = new Float32Array(analysers[0].fftSize);
          entry.meterOutput.connect(splitter);
          entry.nodes.push(...nodes);
          entry.meter = {splitter, analysers, samples};
          attachTrackClipMonitor(entry, entry.meter);
        } catch { nodes.forEach(disposeNode); return null; }
      }
      const {analysers, samples} = entry.meter;
      let peak = 0;
      for (const analyser of analysers) {
        analyser.getFloatTimeDomainData(samples);
        for (let i = 0; i < samples.length; i++) {
          if (Number.isFinite(samples[i])) peak = Math.max(peak, Math.abs(samples[i]));
        }
      }
      if (peak >= 1) entry.clipped = true;
      return peak;
    },

    readTrackClipped(trackId) { return entries.get(trackId)?.clipped === true; },
    resetTrackClipped(trackId) {
      const entry = entries.get(trackId);
      if (!entry) return;
      entry.clipped = false;
      try { entry.meter?.clipNode?.port.postMessage('reset'); } catch {}
    },

    readMasterClipped() { return masterClipped; },
    readMasterInterSample() { return masterInterSample; },
    readMasterLoudness() { return context?.state === 'running' ? masterLoudness : null; },
    resetMasterClipped() {
      masterClipped = false;
      masterInterSample = false;
      try { clipMonitor?.port.postMessage('reset'); } catch {}
    },

    readMasterPeaks() {
      if (!masterMeter || context?.state !== 'running') return null;
      const {analysers, samples} = masterMeter;
      return analysers.map(analyser => {
        analyser.getFloatTimeDomainData(samples);
        let peak = 0;
        for (let i = 0; i < samples.length; i++) {
          if (Number.isFinite(samples[i])) peak = Math.max(peak, Math.abs(samples[i]));
        }
        return peak;
      });
    },

    isReady() {
      return !!context && !!master;
    },

    /**
     * Route an <audio> element through the FX graph.
     * Returns true when the element is under Web Audio control.
     */
    attach(trackId, element, track) {
      if (disposed || !element) return false;
      const existing = entries.get(trackId);
      if (existing && existing.element === element) {
        this.syncTrack(trackId, track);
        return true;
      }
      invalidateSpectral("track attached");
      if (existing) this.detach(trackId);
      if (!this.ensureContext() || !master) return false;

      let source;
      try {
        source = context.createMediaElementSource(element);
      } catch (e) {
        // Element already bound to another context/source, or unsupported.
        console.warn('Studio mixer: FX routing unavailable for track', trackId, e);
        return false;
      }
      // The graph owns level from here; leave the element wide open.
      element.volume = 1;
      entries.set(trackId, { element, source, nodes: [], track: null, gain: 0 });
      rebuild(trackId, track || {}, trackGainValue(track || {}));
      return true;
    },

    isRouted(trackId) {
      return entries.has(trackId);
    },

    /** Push the current track state (fader, mute/solo, pan, inserts, sends) into the graph. */
    syncTrack(trackId, track, { gain } = {}) {
      const entry = entries.get(trackId);
      if (!entry || !context) return false;
      const nextGain = typeof gain === 'number' ? gain : trackGainValue(track || {});
      const prev = entry.track;
      const beforeFx = getTrackEffects(prev);
      const afterFx = prev === track ? beforeFx : getTrackEffects(track);
      let structureChanged = studioFxStructureChanged(prev, track);
      // Only supported insert parameter edits may bypass a rebuild.
      if (structureChanged && (spectralRoutes || spectralStatus.status==='preparing')) invalidateSpectral("insert configuration changed");
      if (structureChanged && prev && !!prev.autoPolish === !!track?.autoPolish) {
        if (canUpdateLiveInserts(beforeFx, afterFx, entry.liveParams)) {
          structureChanged = false;
        }
      }

      if (structureChanged) {
        rebuild(trackId, track || {}, nextGain);
        return true;
      }

      entry.track = track;
      entry.gain = nextGain;
      // Repeated identical targets restart AudioParam smoothing and enqueue
      // redundant events on every animation frame. Only schedule changes.
      const updateTarget = (param, value) => {
        if (!param || !Number.isFinite(value) || entry.parameterTargets.get(param) === value) return;
        param.setTargetAtTime(value, context.currentTime, 0.01);
        entry.parameterTargets.set(param, value);
      };
      updateTarget(entry.trackGain?.gain, nextGain);
      if (beforeFx !== afterFx) {
        const targets = liveInsertTargets(afterFx, context.sampleRate);
        for (const [key, param] of Object.entries(entry.liveParams)) updateTarget(param, targets[key]);
      }
      if (entry.panner) {
        const value = Math.max(-1, Math.min(1, ((track?.pan ?? 50) - 50) / 50));
        updateTarget(entry.panner.pan, value);
      }
      entry.sendGains?.forEach((sendGain, index) => {
        if (!sendGain) return;
        const value = Math.max(0, Math.min(100, track?.[`send${index + 1}`] ?? 0)) / 100;
        updateTarget(sendGain.gain, value);
      });
      return true;
    },

    /** Evaluate and apply track automation at the current transport position. */
    syncAutomation(trackId, track, time, allTracks = []) {
      const automated = automatedTrackState(track || {}, time);
      const automatedTracks = (allTracks || []).map(t => t.id === trackId ? automated : automatedTrackState(t, time));
      const hasSolo = automatedTracks.some(t => t.solo);
      const audible = automated.muted ? false : (hasSolo ? !!automated.solo : true);
      const gain = audible ? trackGainValue(automated) : 0;
      return this.syncTrack(trackId, automated, { gain });
    },

    /** Apply a whole automation frame in O(n), avoiding per-track rescans. */
    syncAutomationFrame(tracks = [], time = 0) {
      const automatedTracks = (tracks || []).map(track => {
        // Static channels need no automation projection on each frame.
        // Keep the original object so insert configuration identity is stable.
        if (!track || ![track.automationPoints, track.panAutomationPoints,
          track.send1AutomationPoints, track.send2AutomationPoints,
          track.send3AutomationPoints, track.muteAutomationPoints].some(points => points?.length)) {
          return track;
        }
        return automatedTrackState(track, time);
      });
      const hasSolo = automatedTracks.some(track => track?.solo);
      automatedTracks.forEach(track => {
        if (!track || !entries.has(track.id)) return;
        const audible = !track.muted && (!hasSolo || !!track.solo);
        this.syncTrack(track.id, track, { gain: audible ? trackGainValue(track) : 0 });
      });
      return automatedTracks;
    },

    /** Update master fader / master inserts. Rebuilds the bus when inserts change. */
    syncMaster({ masterVolume, masterFx }) {
      const volumeChanged = masterVolume !== masterState.masterVolume;
      const previousFx = masterState.masterFx || {};
      const nextFx = masterFx || {};
      const fxChanged = nextFx !== previousFx && JSON.stringify(nextFx) !== JSON.stringify(previousFx);
      masterState = { masterVolume, masterFx };
      if (!context || !master) return;
      if (fxChanged) {
        if (!canUpdateLiveInserts(previousFx, nextFx, master.liveParams)) {
          buildMaster();
          return;
        }
        const targets = liveInsertTargets(nextFx, context.sampleRate);
        const previousTargets = liveInsertTargets(previousFx, context.sampleRate);
        for (const [key, param] of Object.entries(master.liveParams || {})) {
          if (Number.isFinite(targets[key]) && targets[key] !== previousTargets[key]) {
            param.setTargetAtTime(targets[key], context.currentTime, 0.01);
          }
        }
      }
      if (volumeChanged) {
        const value = Math.max(0, Math.min(100, masterVolume ?? 100)) / 100;
        master.volume.gain.setTargetAtTime(value, context.currentTime, 0.01);
      }
    },

    detach(trackId) {
      const entry = entries.get(trackId);
      if (!entry) return;
      invalidateSpectral("track detached");
      teardownEntry(entry);
      entries.delete(trackId);
    },

    dispose() {
      disposed = true;
      releaseSpectral();
      spectralStatus={status:'inactive'};
      entries.forEach(teardownEntry);
      entries.clear();
      if (master) master.nodes.forEach(disposeNode);
      master = null;
      masterMeter = null;
      clipMonitor = null;
      clipModule = null;
      masterClipped = false;
      masterInterSample = false;
      if (context && context.state !== 'closed') context.close().catch(() => {});
      context = null;
    },
  };
}
