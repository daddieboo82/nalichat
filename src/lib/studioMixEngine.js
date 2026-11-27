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

function canUpdateLiveInserts(beforeFx, afterFx, liveParams = {}) {
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
  let masterState = { masterVolume: 100, masterFx: null };
  const entries = new Map(); // trackId -> { element, source, nodes }
  let disposed = false;

  const buildMaster = () => {
    if (!context) return;
    if (master) {
      master.nodes.forEach(disposeNode);
    }
    master = connectMasterChain(context, {
      masterFx: masterState.masterFx,
      masterVolume: masterState.masterVolume,
      destination: context.destination,
    });
    masterMeter = null;
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
    const built = connectTrackChain(context, entry.source, track, {
      destination: master.input,
      reverbBus: master.reverbBus,
      delayBus: master.delayBus,
      cueBus: master.cueBus,
      gain,
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
          entry.meter = {analysers, samples};
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
      return peak;
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
        const targets = studioEqCompTargets(afterFx);
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
        const targets = studioEqCompTargets(nextFx);
        const previousTargets = studioEqCompTargets(previousFx);
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
      teardownEntry(entry);
      entries.delete(trackId);
    },

    dispose() {
      disposed = true;
      entries.forEach(teardownEntry);
      entries.clear();
      if (master) master.nodes.forEach(disposeNode);
      master = null;
      masterMeter = null;
      if (context && context.state !== 'closed') context.close().catch(() => {});
      context = null;
    },
  };
}
