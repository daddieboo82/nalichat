import { describe, expect, it } from 'vitest';
import { studioFxStructureChanged } from './studioFxStructure';

describe('Studio realtime FX structure comparison', () => {
  it('does not rebuild a stable effects rack for normal automation frames', () => {
    const effects = { eq: { low: 1 }, compression: { threshold: -12 } };
    expect(studioFxStructureChanged({ effects, autoPolish: false }, { effects, autoPolish: false, volume: 50 })).toBe(false);
  });

  it('preserves the previous semantic comparison for equivalent new objects', () => {
    expect(studioFxStructureChanged(
      { plugins: { reverb: { wet: 0.2 } } },
      { plugins: { reverb: { wet: 0.2 } } },
    )).toBe(false);
  });

  it('rebuilds when effects, plugin type, or auto polish changes', () => {
    expect(studioFxStructureChanged(null, {})).toBe(true);
    expect(studioFxStructureChanged({ effects: { eq: true } }, { effects: { eq: false } })).toBe(true);
    expect(studioFxStructureChanged({ plugins: { delay: true } }, { plugins: { delay: false } })).toBe(true);
    expect(studioFxStructureChanged({ autoPolish: false }, { autoPolish: true })).toBe(true);
    expect(studioFxStructureChanged({ effects: { eq: true } }, { plugins: { eq: true } })).toBe(false);
  });

  it('handles empty, missing, and null effects without rebuilding', () => {
    expect(studioFxStructureChanged({}, { effects: {} })).toBe(false);
    expect(studioFxStructureChanged({ effects: null }, { plugins: null })).toBe(false);
  });
});
