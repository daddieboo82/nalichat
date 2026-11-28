// Experimental fixed graph latency planning, in integer samples at one context rate.
// Count only algorithmic delay, not creative reverb/delay or device I/O latency.
export function planVoxLatency(tracks, sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Invalid sample rate');
  const ids = new Set();
  let max = 0;
  for (const track of tracks) {
    if (track.id == null || ids.has(track.id)) throw new Error('Unique track IDs required');
    ids.add(track.id);
    if (!Number.isSafeInteger(track.latencySamples) || track.latencySamples < 0 || track.latencySamples > sampleRate*2) throw new RangeError('Invalid algorithmic latency');
    max = Math.max(max, track.latencySamples);
  }
  return {latencySamples:max, latencySeconds:max/sampleRate, tracks:tracks.map(t=>({id:t.id,delaySamples:max-t.latencySamples,delaySeconds:(max-t.latencySamples)/sampleRate}))};
}

// A graph should apply these before the transport begins. Changing a running
// DelayNode's delayTime can introduce pitch/glitch artifacts; do not do that here.
export function connectVoxCompensation(context, source, destination, delaySamples) {
  if (!Number.isSafeInteger(delaySamples) || delaySamples < 0 || delaySamples > context.sampleRate*2) throw new RangeError('Invalid compensation delay');
  if (!delaySamples) { source.connect(destination); return {dispose(){source.disconnect(destination);}}; }
  const delay = context.createDelay(Math.max(1/context.sampleRate,delaySamples/context.sampleRate));
  delay.delayTime.value = delaySamples/context.sampleRate;
  source.connect(delay);delay.connect(destination);
  return {dispose(){try{source.disconnect(delay);}finally{delay.disconnect();}}};
}
