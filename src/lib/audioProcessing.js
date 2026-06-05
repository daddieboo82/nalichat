// Real client-side audio processing helpers (Web Audio API).
// These operate on actual audio data — no simulation.

// Decode an audio URL into an AudioBuffer
async function fetchAudioBuffer(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();
  return buffer;
}

// Render an AudioBuffer to a WAV Blob (16-bit PCM)
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// Build a peak waveform array (0..1) from an AudioBuffer
function bufferToWaveform(buffer, numPoints = 2000) {
  const data = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(data.length / numPoints));
  const wf = new Array(numPoints);
  let maxVal = 0;
  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    let sum = 0, n = 0;
    for (let j = 0; j < blockSize; j += Math.max(1, Math.floor(blockSize / 64))) {
      sum += Math.abs(data[start + j] || 0);
      n++;
    }
    const v = sum / (n || 1);
    wf[i] = v;
    if (v > maxVal) maxVal = v;
  }
  return maxVal > 0 ? wf.map(v => v / maxVal) : wf.map(() => 0.05);
}

// Apply a biquad filter offline (real DSP) and return new AudioBuffer
async function applyFilter(buffer, type, frequency, Q = 1) {
  const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  const filter = offline.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = Q;
  src.connect(filter);
  filter.connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

// Real stem separation by frequency split:
//   "vocals/highs"  -> high-pass (keeps vocals, hats, presence)
//   "instrumental"  -> low-pass (keeps bass, body, drums)
export async function separateStems(url) {
  const buffer = await fetchAudioBuffer(url);
  const highs = await applyFilter(buffer, 'highpass', 1800, 0.7);
  const lows = await applyFilter(buffer, 'lowpass', 1800, 0.7);
  return {
    vocals: {
      url: URL.createObjectURL(audioBufferToWav(highs)),
      waveform: bufferToWaveform(highs),
      duration: highs.duration,
    },
    instrumental: {
      url: URL.createObjectURL(audioBufferToWav(lows)),
      waveform: bufferToWaveform(lows),
      duration: lows.duration,
    },
  };
}

// Real audio synthesis: generate a chord progression melody as actual audio.
export async function generateMelody({ seconds = 8, bpm = 120 } = {}) {
  const sampleRate = 44100;
  const length = Math.floor(seconds * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  // C minor pad-ish progression: Cm, Ab, Eb, Bb
  const chords = [
    [261.63, 311.13, 392.00],
    [207.65, 261.63, 311.13],
    [311.13, 392.00, 466.16],
    [233.08, 293.66, 349.23],
  ];
  const beatDur = 60 / bpm;
  const chordDur = beatDur * 2;
  const master = offline.createGain();
  master.gain.value = 0.25;
  master.connect(offline.destination);

  let t = 0;
  let chordIdx = 0;
  while (t < seconds) {
    const chord = chords[chordIdx % chords.length];
    chord.forEach(freq => {
      const osc = offline.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const g = offline.createGain();
      const lp = offline.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      // ADSR
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.05);
      g.gain.linearRampToValueAtTime(0.3, t + chordDur * 0.5);
      g.gain.linearRampToValueAtTime(0, t + chordDur);
      osc.connect(lp);
      lp.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + chordDur);
    });
    t += chordDur;
    chordIdx++;
  }

  const rendered = await offline.startRendering();
  return {
    url: URL.createObjectURL(audioBufferToWav(rendered)),
    waveform: bufferToWaveform(rendered),
    duration: rendered.duration,
  };
}