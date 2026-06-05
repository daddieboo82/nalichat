/**
 * Lightweight sound-effects hook using the Web Audio API.
 * No external dependencies — generates tones programmatically.
 * Users can disable sounds via localStorage key "nali_sounds_off".
 */

let ctx = null;
let initialized = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      ctx = new AudioContext();
    }
  }
  return ctx;
}

function initAudio() {
  if (initialized) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") {
    ac.resume().catch(() => {});
  }
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.001);
  } catch (e) {}
  initialized = true;
  
  if (typeof document !== "undefined") {
    document.removeEventListener('click', initAudio);
    document.removeEventListener('touchstart', initAudio);
    document.removeEventListener('keydown', initAudio);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
  document.addEventListener('keydown', initAudio, { once: true });
}

function playTone({ frequency = 440, type = "sine", duration = 0.12, volume = 0.18, attack = 0.005, decay = 0.08, delay = 0 }) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("nali_sounds_off") === "1") return;
  
  try {
    const ac = getCtx();
    if (!ac) return;

    const play = () => {
      try {
        const t = ac.currentTime + 0.01 + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start(t);
        osc.stop(t + duration + decay);
      } catch (e) {
        console.warn("Tone error:", e);
      }
    };

    if (ac.state === "suspended") {
      ac.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch (err) {
    console.warn("AudioContext error:", err);
  }
}

export const sounds = {
  click: () => playTone({ frequency: 600, type: "sine", duration: 0.07, volume: 0.12 }),
  hover: () => playTone({ frequency: 900, type: "sine", duration: 0.04, volume: 0.05 }),
  success: () => {
    playTone({ frequency: 660, type: "sine", duration: 0.09, volume: 0.14, delay: 0 });
    playTone({ frequency: 880, type: "sine", duration: 0.1, volume: 0.12, delay: 0.08 });
    playTone({ frequency: 1100, type: "sine", duration: 0.14, volume: 0.11, delay: 0.16 });
  },
  notification: () => {
    playTone({ frequency: 520, type: "sine", duration: 0.08, volume: 0.14, delay: 0 });
    playTone({ frequency: 780, type: "sine", duration: 0.1, volume: 0.11, delay: 0.06 });
  },
  like: () => {
    playTone({ frequency: 700, type: "sine", duration: 0.07, volume: 0.13, delay: 0 });
    playTone({ frequency: 1050, type: "sine", duration: 0.1, volume: 0.10, delay: 0.055 });
    playTone({ frequency: 1400, type: "sine", duration: 0.08, volume: 0.07, delay: 0.11 });
  },
  upload: () => {
    playTone({ frequency: 440, type: "sine", duration: 0.07, volume: 0.11, delay: 0 });
    playTone({ frequency: 660, type: "sine", duration: 0.1, volume: 0.09, delay: 0.06 });
    playTone({ frequency: 880, type: "sine", duration: 0.12, volume: 0.08, delay: 0.12 });
  },
  recStart: () => {
    playTone({ frequency: 220, type: "sine", duration: 0.15, volume: 0.18, delay: 0 });
    playTone({ frequency: 330, type: "sine", duration: 0.2, volume: 0.14, delay: 0.1 });
  },
  recStop: () => {
    playTone({ frequency: 440, type: "sine", duration: 0.12, volume: 0.15, delay: 0 });
    playTone({ frequency: 330, type: "sine", duration: 0.16, volume: 0.12, delay: 0.09 });
    playTone({ frequency: 220, type: "sine", duration: 0.2, volume: 0.10, delay: 0.18 });
  },
  error: () => {
    playTone({ frequency: 300, type: "sawtooth", duration: 0.1, volume: 0.14, delay: 0 });
    playTone({ frequency: 220, type: "sawtooth", duration: 0.18, volume: 0.12, delay: 0.08 });
  },
  nav: () => playTone({ frequency: 480, type: "sine", duration: 0.1, volume: 0.09, attack: 0.02, decay: 0.1 }),
};

/**
 * useSound — returns sound helpers + toggle state.
 * Call isSoundEnabled() to check; toggleSound() to flip.
 */
export function useSound() {
  function isSoundEnabled() {
    return localStorage.getItem("nali_sounds_off") !== "1";
  }
  function toggleSound() {
    if (isSoundEnabled()) {
      localStorage.setItem("nali_sounds_off", "1");
    } else {
      localStorage.removeItem("nali_sounds_off");
      sounds.success();
    }
    // Force re-render in caller if they track this in state
    return !isSoundEnabled();
  }
  return { sounds, isSoundEnabled, toggleSound };
}