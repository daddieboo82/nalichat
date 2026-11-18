// Browser-only vocal polish. No AI provider, upload, or voice cloning required.
// Uses offline Web Audio for a conservative high-pass/compression/peak-safe finish.
import { audioBufferToWav, bufferToWaveform } from './audioProcessing';
import { gpuVocalGain } from './voxGpuProcessing';

export async function polishVocalLocally(sourceBlob, signal) {
  signal?.throwIfAborted();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !window.OfflineAudioContext) {
    throw new Error('This browser does not support offline audio processing.');
  }
  if (!sourceBlob || sourceBlob.size > 50 * 1024 * 1024) {
    throw new Error('Choose an audio recording smaller than 50 MB.');
  }
  const decoder = new AudioContextClass();
  let input;
  try {
    input = await decoder.decodeAudioData(await sourceBlob.arrayBuffer());
  } finally {
    await decoder.close().catch(() => {});
  }
  signal?.throwIfAborted();
  if (!input.length || input.duration < 1 || input.duration > 60) {
    throw new Error('Choose 1–60 seconds of isolated vocal.');
  }

  const channels = Math.min(input.numberOfChannels, 2);
  const context = new OfflineAudioContext(channels, input.length, input.sampleRate);
  const source = context.createBufferSource();
  source.buffer = input;

  const highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 70;
  highPass.Q.value = 0.707;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -21;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;

  source.connect(highPass);
  highPass.connect(compressor);
  compressor.connect(context.destination);
  source.start(0);
  const processed = await context.startRendering();
  signal?.throwIfAborted();

  let peak = 0;
  let sum = 0;
  let count = 0;
  for (let channel = 0; channel < processed.numberOfChannels; channel++) {
    const data = processed.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      if (!Number.isFinite(sample)) throw new Error('The processed audio contains invalid samples.');
      peak = Math.max(peak, Math.abs(sample));
      sum += sample * sample;
      count++;
    }
  }
  // Keep silence silent. No large gain boost that would amplify room noise.
  const rms = Math.sqrt(sum / Math.max(1, count));
  const boost = rms < 0.0001 ? 1 : Math.min(1.6, Math.max(1, 0.12 / rms));
  const level = peak > 0 ? Math.min(boost, 0.93 / peak) : 1;
  let processingBackend = 'cpu';
  if (level !== 1 || peak > 0.93) {
    for (let channel = 0; channel < processed.numberOfChannels; channel++) {
      const data = processed.getChannelData(channel);
      const result = await gpuVocalGain(data, level, { signal });
      data.set(result.samples);
      if (result.backend === 'webgpu') processingBackend = 'webgpu';
    }
  }
  signal?.throwIfAborted();
  return {
    blob: audioBufferToWav(processed),
    waveform: bufferToWaveform(processed),
    duration: processed.duration,
    processingBackend,
  };
}
