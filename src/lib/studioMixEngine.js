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

import {
  connectMasterChain,
  connectTrackChain,
  trackGainValue,
  automatedTrackState,
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

export function createMixEngine() {
  let context = null;
  let master = null;
  let masterState = { masterVolume: 100, masterFx: null };
  const entries = new Map(); // trackId -> { element, source, nodes }
  let disposed = false;

  const buildMaster = () => {
    if (!context) return;
    if (master) {
      master.nodes.forEach(node => { try { node.disconnect(); } catch { /* already gone */ } });
    }
    master = connectMasterChain(context, {
      masterFx: masterState.masterFx,
      masterVolume: masterState.masterVolume,
      destination: context.destination,
    });
    // Re-attach every live channel strip to the rebuilt master bus.
    entries.forEach((entry, trackId) => {
      if (entry.track) rebuild(trackId, entry.track, entry.gain);
    });
  };

  const teardownEntry = (entry) => {
    entry.nodes?.forEach(node => { try { node.disconnect(); } catch { /* already gone */ } });
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
      const structureChanged =
        !prev ||
        JSON.stringify(prev.effects || prev.plugins || {}) !== JSON.stringify((track && (track.effects || track.plugins)) || {});

      if (structureChanged) {
        rebuild(trackId, track || {}, nextGain);
        return true;
      }

      entry.track = track;
      entry.gain = nextGain;
      if (entry.trackGain) {
        entry.trackGain.gain.setTargetAtTime(nextGain, context.currentTime, 0.01);
      }
      const panner = entry.nodes.find(n => n && n.pan);
      if (panner) {
        const value = Math.max(-1, Math.min(1, ((track?.pan ?? 50) - 50) / 50));
        panner.pan.setTargetAtTime(value, context.currentTime, 0.01);
      }
      entry.sendGains?.forEach((sendGain, index) => {
        if (!sendGain) return;
        const value = Math.max(0, Math.min(100, track?.[`send${index + 1}`] ?? 0)) / 100;
        sendGain.gain.setTargetAtTime(value, context.currentTime, 0.01);
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

    /** Update master fader / master inserts. Rebuilds the bus when inserts change. */
    syncMaster({ masterVolume, masterFx }) {
      const volumeChanged = masterVolume !== masterState.masterVolume;
      const fxChanged = JSON.stringify(masterFx || {}) !== JSON.stringify(masterState.masterFx || {});
      masterState = { masterVolume, masterFx };
      if (!context || !master) return;
      if (fxChanged) {
        buildMaster();
        return;
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
      if (master) master.nodes.forEach(node => { try { node.disconnect(); } catch { /* already gone */ } });
      master = null;
      if (context && context.state !== 'closed') context.close().catch(() => {});
      context = null;
    },
  };
}
