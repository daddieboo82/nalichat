// Candidate modes remain opt-in until natural vocal quality and device timing pass.
export const VOX_SPECTRAL_MODES = Object.freeze({
  recording: Object.freeze({frameSize:512,hopSize:128,formantStrength:0.7,levelStrength:0.7}),
  mixing: Object.freeze({frameSize:1024,hopSize:256,formantStrength:0.7,levelStrength:0.7}),
  rendering: Object.freeze({frameSize:2048,hopSize:512,formantStrength:0.7,levelStrength:0.7}),
});
export function resolveVoxSpectralOptions(options = {}) {
  const {mode, ...overrides} = options;
  if (mode !== undefined && !Object.hasOwn(VOX_SPECTRAL_MODES,mode)) throw new RangeError('Unknown spectral mode');
  return {...(mode === undefined ? {} : VOX_SPECTRAL_MODES[mode]), ...overrides};
}
