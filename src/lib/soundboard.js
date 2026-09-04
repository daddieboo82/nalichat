/**
 * Programmatic soundboard effects for voice messages.
 * Each effect generates sound using the Web Audio API — no external files needed.
 * Pass an AudioContext to each play() function.
 */

export const SOUNDBOARD_SOUNDS = [
  {
    id: "applause",
    emoji: "👏",
    label: "Applause",
    play: (ctx) => {
      const dur = 1.2;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        const env = Math.exp(-t * 1.5);
        const clap = Math.sin(t * 25 + Math.sin(t * 3)) > 0.5 ? 1 : 0.2;
        data[i] = (Math.random() * 2 - 1) * env * 0.25 * clap;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 1.5;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    },
  },
  {
    id: "laugh",
    emoji: "😂",
    label: "Laugh",
    play: (ctx) => {
      [0, 0.12, 0.24, 0.42, 0.6].forEach((delay, i) => {
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(280 - i * 15, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      });
    },
  },
  {
    id: "airhorn",
    emoji: "📯",
    label: "Airhorn",
    play: (ctx) => {
      const t = ctx.currentTime;
      [220, 277, 330].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
        gain.gain.setValueAtTime(0.12, t + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.95);
      });
    },
  },
  {
    id: "drum",
    emoji: "🥁",
    label: "Drum Roll",
    play: (ctx) => {
      [0, 0.1, 0.2, 0.3, 0.35].forEach((delay) => {
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
      });
    },
  },
  {
    id: "wow",
    emoji: "😮",
    label: "Wow",
    play: (ctx) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.5);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    },
  },
  {
    id: "boom",
    emoji: "💥",
    label: "Boom",
    play: (ctx) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
      // Noise burst for impact
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02)) * 0.3;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.connect(ctx.destination);
      noise.start(t);
    },
  },
];