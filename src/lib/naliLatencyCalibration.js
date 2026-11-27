// Optional one-tap acoustic latency calibration. A quiet calibration sound
// plays through the output device and is captured by the same device mic.
// Never upload the capture, assume network latency == acoustic latency,
// or apply corrections after a failed/low-confidence measurement.
import { openStudioMicrophone } from './sharedStudioCapture';
import {
  NALI_LATENCY_PROBE_MS, makeLatencyProbe, estimateStudioRoundTrip,
} from './naliLatencyEngine';

export async function calibrateNaliStudioLatency({
  signal,
  mediaDevices = globalThis.navigator?.mediaDevices,
  AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext,
  AudioWorkletNodeType = globalThis.AudioWorkletNode,
  onStatus,
} = {}) {
  if (!AudioContextType || !AudioWorkletNodeType) throw new Error('Audio calibration requires a browser with AudioWorklet.');
  signal?.throwIfAborted();
  let stream = null;
  let context = null, input = null, worklet = null, mute = null, volume = null;
  let sources = [];
  let routeChanged = false;
  const onDeviceChange = () => { routeChanged = true; };
  try {
    onStatus?.('Opening microphone for a short speaker test…');
    stream = await openStudioMicrophone(mediaDevices);
    signal?.throwIfAborted();
    mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    context = new AudioContextType({ latencyHint: 'interactive' });
    if (!context.audioWorklet?.addModule) throw new Error('AudioWorklet is unavailable.');
    await context.audioWorklet.addModule('/audio/nali-latency-probe.worklet.js');
    signal?.throwIfAborted();
    input = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNodeType(context, 'nali-latency-probe', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    });
    mute = context.createGain();
    mute.gain.value = 0;
    input.connect(worklet);
    worklet.connect(mute);
    mute.connect(context.destination);
    volume = context.createGain();
    volume.gain.value = 1;
    volume.connect(context.destination);
    await context.resume();
    signal?.throwIfAborted();
    const rate = context.sampleRate;
    const pulse = makeLatencyProbe(rate);
    const initial = context.currentTime;
    const frames = NALI_LATENCY_PROBE_MS.map(ms => Math.round((initial + ms / 1000) * rate));
    const capture = new Float32Array(Math.round((initial + 2.25) * rate));
    let chunks = 0;
    worklet.port.onmessage = ({ data }) => {
      if (data?.type !== 'audio' || !(data.samples instanceof ArrayBuffer)) return;
      const first = Number(data.firstFrame);
      if (!Number.isSafeInteger(first) || first < 0 || first >= capture.length) return;
      const samples = new Float32Array(data.samples);
      capture.set(samples.subarray(0, capture.length - first), first);
      chunks++;
    };
    for (const frame of frames) {
      const buffer = context.createBuffer(1, pulse.length, rate);
      buffer.copyToChannel(pulse, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(volume);
      source.start(frame / rate);
      sources.push(source);
    }
    onStatus?.('Playing three short calibration sounds…');
    const waitUntil = initial + 2.1;
    const deadline = Date.now() + 7500;
    while (context.currentTime < waitUntil) {
      if (Date.now() > deadline) throw new Error('Device calibration timed out. No correction was applied.');
      signal?.throwIfAborted();
      await new Promise(resolve => setTimeout(resolve, 35));
      if (context.state !== 'running') throw new Error('Audio playback was interrupted; calibration stopped.');
    }
    worklet.port.postMessage({type:'flush'});
    await new Promise(resolve => setTimeout(resolve, 90));
    signal?.throwIfAborted();
    if (routeChanged || context.state !== 'running' || stream.getAudioTracks?.().some(track => track.readyState === 'ended')) {
      throw new Error('Audio device changed or disconnected during calibration. Please try again.');
    }
    if (!chunks) throw new Error('Your microphone did not provide calibration audio.');
    onStatus?.('Checking microphone and speaker timing…');
    const result = estimateStudioRoundTrip({ captured: capture, reference: pulse, pulseFrames: frames, sampleRate: rate });
    return {
      ...result,
      browserOutputLatencyMs: Number.isFinite(context.outputLatency) ? Math.round(context.outputLatency * 1000 * 10) / 10 : null,
      browserBaseLatencyMs: Number.isFinite(context.baseLatency) ? Math.round(context.baseLatency * 1000 * 10) / 10 : null,
      micDeviceId: stream.getAudioTracks?.()[0]?.getSettings?.().deviceId || null,
    };
  } finally {
    mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    for (const source of sources) { try { source.stop(); } catch {} try { source.disconnect(); } catch {} }
    try { input?.disconnect(); worklet?.disconnect(); mute?.disconnect(); volume?.disconnect(); } catch {}
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== 'closed') await context.close().catch(() => {});
  }
}
