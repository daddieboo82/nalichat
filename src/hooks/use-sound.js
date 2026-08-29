/**
 * Lightweight sound-effects hook using the Web Audio API.
 * No external dependencies — generates tones programmatically.
 * Users can disable sounds via localStorage key "nali_sounds_off".
 */

// Always start with audio feedback on (reset persisted off-state)
if (typeof window !== "undefined") {
  localStorage.removeItem("nali_sounds_off");
}

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
  // Soft, satisfying tick — a quick sine pop with a subtle higher harmonic for clarity
  click: () => {
    playTone({ frequency: 520, type: "sine", duration: 0.05, volume: 0.10, attack: 0.002, decay: 0.04 });
    playTone({ frequency: 1040, type: "sine", duration: 0.04, volume: 0.04, attack: 0.002, decay: 0.03, delay: 0.005 });
  },
  // Lighter tick for hovers — barely perceptible
  hover: () => playTone({ frequency: 880, type: "sine", duration: 0.03, volume: 0.03, attack: 0.002, decay: 0.02 }),
  // Bright ascending arpeggio — a triumphant success chime
  success: () => {
    playTone({ frequency: 523, type: "sine", duration: 0.08, volume: 0.12, delay: 0 });
    playTone({ frequency: 659, type: "sine", duration: 0.08, volume: 0.12, delay: 0.07 });
    playTone({ frequency: 784, type: "sine", duration: 0.10, volume: 0.12, delay: 0.14 });
    playTone({ frequency: 1047, type: "sine", duration: 0.16, volume: 0.11, delay: 0.21 });
  },
  // Gentle two-note bell — warm and inviting, like a soft marimba
  notification: () => {
    playTone({ frequency: 587, type: "sine", duration: 0.12, volume: 0.13, attack: 0.004, decay: 0.10, delay: 0 });
    playTone({ frequency: 880, type: "sine", duration: 0.18, volume: 0.11, attack: 0.004, decay: 0.16, delay: 0.09 });
    playTone({ frequency: 1175, type: "sine", duration: 0.14, volume: 0.06, attack: 0.004, decay: 0.12, delay: 0.09 });
  },
  // Sparkly ascending triad — a delightful "like"
  like: () => {
    playTone({ frequency: 784, type: "sine", duration: 0.06, volume: 0.11, delay: 0 });
    playTone({ frequency: 1175, type: "sine", duration: 0.08, volume: 0.09, delay: 0.04 });
    playTone({ frequency: 1568, type: "sine", duration: 0.10, volume: 0.07, delay: 0.08 });
  },
  // Rising sweep — files uploading
  upload: () => {
    playTone({ frequency: 392, type: "sine", duration: 0.07, volume: 0.10, delay: 0 });
    playTone({ frequency: 523, type: "sine", duration: 0.08, volume: 0.09, delay: 0.05 });
    playTone({ frequency: 659, type: "sine", duration: 0.10, volume: 0.08, delay: 0.10 });
    playTone({ frequency: 784, type: "sine", duration: 0.12, volume: 0.07, delay: 0.15 });
  },
  // Deep countdown-style start
  recStart: () => {
    playTone({ frequency: 196, type: "sine", duration: 0.15, volume: 0.16, delay: 0 });
    playTone({ frequency: 294, type: "sine", duration: 0.20, volume: 0.13, delay: 0.10 });
  },
  // Per-step countdown beep (3, 2, 1)
  countdown: () => playTone({ frequency: 660, type: "sine", duration: 0.10, volume: 0.14, attack: 0.005, decay: 0.08 }),
  // Final "go" tone at the end of the countdown
  countdownGo: () => playTone({ frequency: 990, type: "sine", duration: 0.18, volume: 0.15, attack: 0.005, decay: 0.12 }),
  // Descending resolve — recording stopped
  recStop: () => {
    playTone({ frequency: 392, type: "sine", duration: 0.10, volume: 0.13, delay: 0 });
    playTone({ frequency: 294, type: "sine", duration: 0.14, volume: 0.11, delay: 0.07 });
    playTone({ frequency: 196, type: "sine", duration: 0.18, volume: 0.09, delay: 0.14 });
  },
  // Low buzz — something went wrong
  error: () => {
    playTone({ frequency: 311, type: "sawtooth", duration: 0.09, volume: 0.12, delay: 0 });
    playTone({ frequency: 233, type: "sawtooth", duration: 0.16, volume: 0.10, delay: 0.07 });
  },
  // Soft navigation whoosh
  nav: () => playTone({ frequency: 440, type: "sine", duration: 0.08, volume: 0.08, attack: 0.02, decay: 0.08 }),
  // Premium startup chime — a warm, welcoming ascending arpeggio for the splash screen
  startup: () => {
    playTone({ frequency: 261, type: "sine", duration: 0.18, volume: 0.14, attack: 0.01, decay: 0.14, delay: 0 });
    playTone({ frequency: 392, type: "sine", duration: 0.18, volume: 0.13, attack: 0.01, decay: 0.14, delay: 0.10 });
    playTone({ frequency: 523, type: "sine", duration: 0.20, volume: 0.13, attack: 0.01, decay: 0.16, delay: 0.20 });
    playTone({ frequency: 659, type: "sine", duration: 0.22, volume: 0.12, attack: 0.01, decay: 0.18, delay: 0.30 });
    playTone({ frequency: 784, type: "sine", duration: 0.30, volume: 0.11, attack: 0.01, decay: 0.26, delay: 0.40 });
    // Sparkle on top
    playTone({ frequency: 1568, type: "sine", duration: 0.20, volume: 0.05, attack: 0.01, decay: 0.16, delay: 0.45 });
  },
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