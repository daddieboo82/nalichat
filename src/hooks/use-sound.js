/**
 * Lightweight sound-effects hook using the Web Audio API.
 * No external dependencies — generates tones programmatically.
 * Users can disable sounds via localStorage key "nali_sounds_off".
 */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function playTone({ frequency = 440, type = "sine", duration = 0.12, volume = 0.18, attack = 0.005, decay = 0.08 }) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("nali_sounds_off") === "1") return;
  try {
    const ac = getCtx();
    if (ac.state === "suspended") ac.resume();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime);
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration + decay);
  } catch (_) { /* silently ignore */ }
}

export const sounds = {
  /** Soft click — nav or button press */
  click: () => playTone({ frequency: 600, type: "sine", duration: 0.07, volume: 0.12 }),

  /** Hover — very subtle high tick */
  hover: () => playTone({ frequency: 900, type: "sine", duration: 0.04, volume: 0.05 }),

  /** Success — warm three-tone rise */
  success: () => {
    playTone({ frequency: 660, type: "sine", duration: 0.09, volume: 0.14 });
    setTimeout(() => playTone({ frequency: 880, type: "sine", duration: 0.1, volume: 0.12 }), 80);
    setTimeout(() => playTone({ frequency: 1100, type: "sine", duration: 0.14, volume: 0.11 }), 160);
  },

  /** Notification pop — rising duo */
  notification: () => {
    playTone({ frequency: 520, type: "sine", duration: 0.08, volume: 0.14 });
    setTimeout(() => playTone({ frequency: 780, type: "sine", duration: 0.1, volume: 0.11 }), 60);
  },

  /** Like / heart — sparkle */
  like: () => {
    playTone({ frequency: 700, type: "sine", duration: 0.07, volume: 0.13 });
    setTimeout(() => playTone({ frequency: 1050, type: "sine", duration: 0.1, volume: 0.10 }), 55);
    setTimeout(() => playTone({ frequency: 1400, type: "sine", duration: 0.08, volume: 0.07 }), 110);
  },

  /** Message send — soft swoosh trio */
  upload: () => {
    playTone({ frequency: 440, type: "sine", duration: 0.07, volume: 0.11 });
    setTimeout(() => playTone({ frequency: 660, type: "sine", duration: 0.1, volume: 0.09 }), 60);
    setTimeout(() => playTone({ frequency: 880, type: "sine", duration: 0.12, volume: 0.08 }), 120);
  },

  /** Recording start — deep pulse */
  recStart: () => {
    playTone({ frequency: 220, type: "sine", duration: 0.15, volume: 0.18 });
    setTimeout(() => playTone({ frequency: 330, type: "sine", duration: 0.2, volume: 0.14 }), 100);
  },

  /** Recording stop — affirming drop */
  recStop: () => {
    playTone({ frequency: 440, type: "sine", duration: 0.12, volume: 0.15 });
    setTimeout(() => playTone({ frequency: 330, type: "sine", duration: 0.16, volume: 0.12 }), 90);
    setTimeout(() => playTone({ frequency: 220, type: "sine", duration: 0.2, volume: 0.10 }), 180);
  },

  /** Error / alert */
  error: () => {
    playTone({ frequency: 300, type: "sawtooth", duration: 0.1, volume: 0.14 });
    setTimeout(() => playTone({ frequency: 220, type: "sawtooth", duration: 0.18, volume: 0.12 }), 80);
  },

  /** Page nav — light whoosh */
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