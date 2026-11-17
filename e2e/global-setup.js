import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 44100;
const SECONDS = 5;
const BITS_PER_SAMPLE = 16;

// Chromium only opens a fake microphone when --use-file-for-fake-audio-capture
// points at a real WAV. Recording specs need that device to exist, so create a
// short silent one before any browser launches. An existing file is left alone.
function silentWav(durationSeconds) {
  const channels = 1;
  const byteRate = SAMPLE_RATE * channels * (BITS_PER_SAMPLE / 8);
  const dataSize = SAMPLE_RATE * durationSeconds * channels * (BITS_PER_SAMPLE / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(channels * (BITS_PER_SAMPLE / 8), 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer; // the data chunk stays zeroed, which is silence
}

export default function globalSetup() {
  if (process.env.E2E_FAKE_MEDIA !== '1') return;

  const file = process.env.E2E_FAKE_AUDIO_FILE || '/tmp/nalichat-e2e-audio.wav';
  if (fs.existsSync(file)) return;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, silentWav(SECONDS));
}