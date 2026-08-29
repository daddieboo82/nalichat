// Plays an edited clip (segments with gain / fades) through WebAudio so that
// splits, deletes, mutes and fades made in the Wave Editor are actually audible.

const bufferCache = new Map(); // audioUrl -> AudioBuffer

async function loadBuffer(url, ctx) {
  if (bufferCache.has(url)) return bufferCache.get(url);
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  bufferCache.set(url, buffer);
  return buffer;
}

export function createSegmentPlayer() {
  let ctx = null;
  let buffer = null;
  let loadedUrl = null;
  let nodes = [];

  const stop = () => {
    nodes.forEach(n => { try { n.stop(); } catch (e) {} });
    nodes = [];
  };

  return {
    async load(audioUrl) {
      if (!audioUrl) return false;
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (loadedUrl !== audioUrl || !buffer) {
        buffer = await loadBuffer(audioUrl, ctx);
        loadedUrl = audioUrl;
      }
      return true;
    },

    async play(segments, fromTime = 0) {
      if (!ctx || !buffer) return;
      if (ctx.state === 'suspended') await ctx.resume();
      stop();

      const t0 = ctx.currentTime + 0.05;
      (segments || []).forEach(seg => {
        const segEnd = seg.startOffset + seg.duration;
        if (segEnd <= fromTime) return;

        const skip = Math.max(0, fromTime - seg.startOffset);
        const duration = seg.duration - skip;
        if (duration <= 0.005) return;

        const when = t0 + Math.max(0, seg.startOffset - fromTime);
        const gainValue = seg.gain ?? 1;

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(gainValue, when);

        const fadeIn = Math.min(Math.max(0, (seg.fadeIn || 0) - skip), duration);
        const fadeOut = Math.min(seg.fadeOut || 0, duration);
        if (fadeIn > 0) {
          gain.gain.setValueAtTime(0, when);
          gain.gain.linearRampToValueAtTime(gainValue, when + fadeIn);
        }
        if (fadeOut > 0) {
          gain.gain.setValueAtTime(gainValue, when + duration - fadeOut);
          gain.gain.linearRampToValueAtTime(0, when + duration);
        }

        src.connect(gain);
        gain.connect(ctx.destination);

        // sourceStart / sourceEnd are normalized (0-1) positions in the source file
        const offset = Math.min(
          buffer.duration,
          Math.max(0, (seg.sourceStart ?? 0) * buffer.duration + skip)
        );
        src.start(when, offset, Math.min(duration, buffer.duration - offset));
        nodes.push(src);
      });
    },

    stop,

    dispose() {
      stop();
      if (ctx && ctx.state !== 'closed') ctx.close();
      ctx = null;
      buffer = null;
      loadedUrl = null;
    }
  };
}