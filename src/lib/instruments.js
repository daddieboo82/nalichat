// Software Instrument engine.
//
// The Studio lets you create "Software Instrument" / "MIDI" tracks and pick an
// instrument, but nothing ever turned that choice into sound. This module renders
// a real musical phrase for the selected instrument using offline Web Audio
// synthesis, in the session's key and tempo, and hands back audio the rest of the
// studio already knows how to handle (audioUrl + waveform + duration), so
// instrument tracks play, mix, take FX, and export like any other track.

import { audioBufferToWav, bufferToWaveform } from '@/lib/audioProcessing';

export const INSTRUMENTS = [
  { id: 'default', name: 'Default Synth', desc: 'Warm detuned saw pad' },
  { id: 'piano', name: 'Grand Piano', desc: 'Struck string with natural decay' },
  { id: 'drums', name: 'Drum Machine', desc: 'Kick, snare and hats' },
  { id: 'bass', name: 'Sub Bass', desc: 'Deep sine sub with bite' },
  { id: 'external', name: 'External MIDI', desc: 'Routed to external gear - not synthesized' },
];

export const MIDI_CHANNELS = ['all', '1', '2', '3', '4'];

export const isSynthesizable = (instrumentId) =>
  INSTRUMENTS.some(i => i.id === instrumentId) && instrumentId !== 'external';

export const getInstrument = (instrumentId) =>
  INSTRUMENTS.find(i => i.id === instrumentId) || INSTRUMENTS[0];

const NOTE_OFFSETS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

/** Parse a session key like "C Maj", "F# Min", "Ab Maj" into a root + scale. */
export function parseKey(songKey = 'C Maj') {
  const raw = String(songKey).trim();
  const match = raw.match(/^([A-G])([#b]?)/i);
  let root = 0;
  if (match) {
    const letter = match[1].toUpperCase();
    root = NOTE_OFFSETS[letter] ?? 0;
    if (match[2] === '#') root += 1;
    if (match[2] === 'b') root -= 1;
  }
  const minor = /min|m\b/i.test(raw) && !/maj/i.test(raw);
  return { root: ((root % 12) + 12) % 12, steps: minor ? MINOR_STEPS : MAJOR_STEPS, minor };
}

/** MIDI note number -> frequency in Hz. */
const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Nth degree of the scale (can exceed an octave) -> MIDI note. */
function degreeToMidi(degree, root, steps, octave) {
  const idx = ((degree % steps.length) + steps.length) % steps.length;
  const octaveShift = Math.floor(degree / steps.length);
  return 12 * (octave + 1 + octaveShift) + root + steps[idx];
}

/** Simple ADSR applied to a gain node. */
function envelope(gain, t, dur, { attack = 0.01, decay = 0.1, sustain = 0.6, release = 0.2, peak = 1 }) {
  const end = t + dur;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.linearRampToValueAtTime(peak * sustain, t + attack + decay);
  gain.gain.setValueAtTime(peak * sustain, Math.max(t + attack + decay, end - release));
  gain.gain.linearRampToValueAtTime(0.0001, end);
}

function voiceSynth(ctx, dest, freq, t, dur) {
  // Two slightly detuned saws through a lowpass = classic warm pad
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, t);
  filter.frequency.linearRampToValueAtTime(2200, t + Math.min(0.25, dur));
  filter.Q.value = 6;
  const g = ctx.createGain();
  envelope(g, t, dur, { attack: 0.02, decay: 0.12, sustain: 0.65, release: 0.15, peak: 0.34 });
  [-6, 6].forEach(cents => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur);
  });
  filter.connect(g);
  g.connect(dest);
}

function voicePiano(ctx, dest, freq, t, dur) {
  // Struck-string character: bright inharmonic attack, fast exponential decay
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const partials = [
    { mult: 1, gain: 1, type: 'triangle' },
    { mult: 2.01, gain: 0.32, type: 'sine' },
    { mult: 3.02, gain: 0.14, type: 'sine' },
    { mult: 4.04, gain: 0.06, type: 'sine' },
  ];
  partials.forEach(p => {
    const osc = ctx.createOscillator();
    osc.type = p.type;
    osc.frequency.value = freq * p.mult;
    const pg = ctx.createGain();
    pg.gain.value = p.gain;
    osc.connect(pg);
    pg.connect(g);
    osc.start(t);
    osc.stop(t + dur);
  });
  g.connect(dest);
}

function voiceBass(ctx, dest, freq, t, dur) {
  // Sine sub for weight plus a filtered saw for definition on small speakers
  const g = ctx.createGain();
  envelope(g, t, dur, { attack: 0.008, decay: 0.09, sustain: 0.75, release: 0.08, peak: 0.55 });
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = freq;
  sub.connect(g);
  sub.start(t);
  sub.stop(t + dur);

  const bite = ctx.createOscillator();
  bite.type = 'sawtooth';
  bite.frequency.value = freq;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const biteGain = ctx.createGain();
  biteGain.gain.value = 0.28;
  bite.connect(lp);
  lp.connect(biteGain);
  biteGain.connect(g);
  bite.start(t);
  bite.stop(t + dur);

  g.connect(dest);
}

function noiseBurst(ctx, dest, t, dur, { type = 'highpass', freq = 6000, peak = 0.3 }) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur);
}

function voiceKick(ctx, dest, t) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + 0.34);
}

function voiceSnare(ctx, dest, t) {
  noiseBurst(ctx, dest, t, 0.18, { type: 'highpass', freq: 1400, peak: 0.42 });
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + 0.12);
}

/**
 * Render a phrase for an instrument into playable audio.
 * Returns { url, waveform, duration } matching the shape Studio tracks expect.
 */
export async function renderInstrumentPhrase({
  instrument = 'default',
  bpm = 120,
  songKey = 'C Maj',
  bars = 4,
  midiNotes = [],
} = {}) {
  if (!isSynthesizable(instrument)) {
    throw new Error('External MIDI routes to outboard gear and cannot be rendered internally.');
  }

  const safeBpm = Math.min(300, Math.max(20, Number(bpm) || 120));
  const safeBars = Math.min(32, Math.max(1, Number(bars) || 4));
  const beat = 60 / safeBpm;
  const seconds = beat * 4 * safeBars;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);

  const master = offline.createGain();
  master.gain.value = 0.85;
  master.connect(offline.destination);

  const { root, steps } = parseKey(songKey);

  // Editable MIDI clips take priority over the generated starter phrase.
  // Notes use beat-based timing so tempo changes preserve the musical performance.
  if (Array.isArray(midiNotes) && midiNotes.length > 0) {
    midiNotes.forEach(note => {
      const midi = Math.max(0, Math.min(127, Number(note.note) || 60));
      const t = Math.max(0, Number(note.startBeat) || 0) * beat;
      const dur = Math.max(0.03, (Number(note.durationBeats) || 1) * beat);
      const velocity = Math.max(1, Math.min(127, Number(note.velocity) || 100)) / 127;
      const noteGain = offline.createGain();
      noteGain.gain.value = velocity;
      noteGain.connect(master);
      const freq = midiToFreq(midi);
      if (instrument === 'bass') voiceBass(offline, noteGain, freq, t, dur);
      else if (instrument === 'piano') voicePiano(offline, noteGain, freq, t, dur);
      else if (instrument === 'drums') {
        if (midi === 36 || midi === 35) voiceKick(offline, noteGain, t);
        else if (midi === 38 || midi === 40) voiceSnare(offline, noteGain, t);
        else noiseBurst(offline, noteGain, t, Math.min(0.2, dur), { type: 'highpass', freq: 8000, peak: 0.16 });
      } else voiceSynth(offline, noteGain, freq, t, dur);
    });
  } else if (instrument === 'drums') {
    const step = beat / 2; // eighth notes
    const totalSteps = Math.floor(seconds / step);
    for (let i = 0; i < totalSteps; i++) {
      const t = i * step;
      const inBar = i % 8;
      if (inBar === 0 || inBar === 3 || inBar === 6) voiceKick(offline, master, t);
      if (inBar === 4) voiceSnare(offline, master, t);
      // Hats on every eighth, accented on the downbeat
      noiseBurst(offline, master, t, 0.05, { type: 'highpass', freq: 8000, peak: inBar % 2 === 0 ? 0.16 : 0.09 });
    }
  } else if (instrument === 'bass') {
    const step = beat; // quarter notes
    const pattern = [0, 0, 4, 2];
    const total = Math.floor(seconds / step);
    for (let i = 0; i < total; i++) {
      const degree = pattern[i % pattern.length];
      const freq = midiToFreq(degreeToMidi(degree, root, steps, 1));
      voiceBass(offline, master, freq, i * step, step * 0.92);
    }
  } else if (instrument === 'piano') {
    // Arpeggiated triad per bar, walking the scale
    const step = beat / 2;
    const total = Math.floor(seconds / step);
    const arp = [0, 2, 4, 2];
    for (let i = 0; i < total; i++) {
      const barDegree = Math.floor(i / 8) % steps.length;
      const degree = barDegree + arp[i % arp.length];
      const freq = midiToFreq(degreeToMidi(degree, root, steps, 4));
      voicePiano(offline, master, freq, i * step, step * 1.6);
    }
  } else {
    // Default synth: sustained triad pad, one chord per bar
    const chordDur = beat * 4;
    const progression = [0, 3, 4, 2];
    const total = Math.ceil(seconds / chordDur);
    for (let i = 0; i < total; i++) {
      const rootDegree = progression[i % progression.length];
      [0, 2, 4].forEach(interval => {
        const freq = midiToFreq(degreeToMidi(rootDegree + interval, root, steps, 3));
        voiceSynth(offline, master, freq, i * chordDur, chordDur * 0.98);
      });
    }
  }

  const rendered = await offline.startRendering();
  return {
    url: URL.createObjectURL(audioBufferToWav(rendered)),
    waveform: bufferToWaveform(rendered, 2000),
    duration: rendered.duration,
  };
}
