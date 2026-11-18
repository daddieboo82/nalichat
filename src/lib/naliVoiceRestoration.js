// NaliVoice's first-party research restoration pipeline.
// Training and inference execute on the user's device and do not require
// third-party pretrained voice checkpoints, accounts or hosted inference.
import { audioBufferToWav, bufferToWaveform } from './audioProcessing';
import { studioClipAudioRange } from './studioClipAudioRange';
import { runNaliVoiceWorker } from './naliVoiceWorkerClient';

// This is an original trainable proof-of-concept and NOT full generative voice
// synthesis. It cannot imitate artists, reconstruct missing syllables, or
// promise Suno-level audio. Keep the original clip and save only a new track.
export async function restoreWithNaliVoice({
  track, signal, onStatus, fetchImpl = fetch,
} = {}) {
  signal?.throwIfAborted();
  if (!track?.audioUrl) throw new Error('Select a recorded audio clip first.');
  onStatus?.('Preparing your vocal on this device…');
  const response = await fetchImpl(track.audioUrl, { signal });
  if (!response?.ok) throw new Error('The selected audio clip could not be read.');
  const blob = await response.blob();
  if (!blob || blob.size > 50 * 1024 * 1024) {
    throw new Error('NaliVoice accepts audio files smaller than 50 MB.');
  }
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  const OfflineContextType = window.OfflineAudioContext || globalThis.OfflineAudioContext;
  if (!AudioContextType || !OfflineContextType) {
    throw new Error('This browser does not support local NaliVoice audio processing.');
  }
  const ctx = new AudioContextType();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await ctx.close().catch(() => {});
  }
  const range = studioClipAudioRange(track, decoded.duration);
  if (!range || range.duration < 1 || range.duration > 20) {
    throw new Error('Select a 1–20 second audio region for the NaliVoice research engine.');
  }
  signal?.throwIfAborted();
  const rate = 16000;
  const offline = new OfflineContextType(1, Math.max(1, Math.round(rate * range.duration)), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0, range.offset, range.duration);
  const mono = await offline.startRendering();
  signal?.throwIfAborted();
  const samples = mono.getChannelData(0).slice();
  onStatus?.('Training and applying the original NaliVoice neural restorer…');
  const restored = await runNaliVoiceWorker(samples, { signal, onStatus });
  const output = offline.createBuffer(1, restored.length, rate);
  output.copyToChannel(restored, 0);
  signal?.throwIfAborted();
  return {
    blob: audioBufferToWav(output),
    waveform: bufferToWaveform(output),
    duration: output.duration,
    processingBackend: 'nali-voice-research',
  };
}
