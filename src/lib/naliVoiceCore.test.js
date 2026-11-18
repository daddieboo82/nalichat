import { describe, expect, it } from 'vitest';
import {
  createNaliVoiceModel, inferNaliVoice, trainNaliVoiceRestorer, validateNaliVoiceModel,
  NALI_VOICE_ENGINE_INFO,
} from './naliVoiceCore';

const sine = (n = 4096) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 17) * 0.24);

describe('NaliBase original NaliVoice research engine', () => {
  it('initializes independent original model weights without third-party checkpoints', () => {
    const a = createNaliVoiceModel();
    const b = createNaliVoiceModel();
    expect(a.format).toBe('nalivoice-residual-v1');
    expect(a.w1).not.toBe(b.w1);
    expect(NALI_VOICE_ENGINE_INFO.externalWeights).toBe(false);
    expect(validateNaliVoiceModel(a)).toBe(true);
  });

  it('runs self-supervised training and creates aligned audio', () => {
    const input = sine();
    const model = createNaliVoiceModel();
    const baseline = new Float32Array(model.w2);
    trainNaliVoiceRestorer(model, input, { iterations: 160 });
    expect(model.trainedSteps).toBe(160);
    expect(Array.from(model.w2)).not.toEqual(Array.from(baseline));
    const restored = inferNaliVoice(model, input);
    expect(restored).toHaveLength(input.length);
    expect(restored.every(Number.isFinite)).toBe(true);
    expect(Math.max(...restored.map(Math.abs))).toBeLessThanOrEqual(0.98);
    expect(input[100]).toBeCloseTo(sine()[100]);
  });

  it('preserves signal length and supports exact dry blend', () => {
    const original = sine(1200);
    const result = inferNaliVoice(createNaliVoiceModel(), original, { blend: 0 });
    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('rejects malformed checkpoints and stops on cancellation', () => {
    expect(() => validateNaliVoiceModel({})).toThrow();
    const abort = new AbortController();
    abort.abort();
    expect(() => trainNaliVoiceRestorer(createNaliVoiceModel(), sine(), { signal: abort.signal })).toThrow();
  });
});
