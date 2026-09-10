import { describe, it, expect } from 'vitest';
import { parseKey, isSynthesizable, getInstrument, INSTRUMENTS } from '@/lib/instruments';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

describe('parseKey', () => {
  it('parses the natural keys the Studio key selector emits', () => {
    expect(parseKey('C Maj')).toMatchObject({ root: 0, minor: false, steps: MAJOR });
    expect(parseKey('G Maj').root).toBe(7);
    expect(parseKey('A Min')).toMatchObject({ root: 9, minor: true, steps: MINOR });
  });

  it('handles sharps and flats', () => {
    expect(parseKey('F# Maj').root).toBe(6);
    expect(parseKey('Bb Min')).toMatchObject({ root: 10, minor: true });
    // Cb wraps below zero and must stay a valid pitch class.
    expect(parseKey('Cb Maj').root).toBe(11);
  });

  it('is case insensitive on the mode', () => {
    expect(parseKey('d min').minor).toBe(true);
    expect(parseKey('D MAJ').minor).toBe(false);
  });

  it('falls back to C major on unparseable input instead of throwing', () => {
    expect(parseKey('???')).toMatchObject({ root: 0, minor: false });
    expect(parseKey('')).toMatchObject({ root: 0, minor: false });
    expect(parseKey(undefined)).toMatchObject({ root: 0, minor: false });
  });

  it('always returns a pitch class in 0..11', () => {
    ['C', 'Cb', 'B#', 'F#', 'Gb', 'A', 'Eb'].forEach(k => {
      const { root } = parseKey(`${k} Maj`);
      expect(root).toBeGreaterThanOrEqual(0);
      expect(root).toBeLessThan(12);
    });
  });
});

describe('instrument catalog', () => {
  it('marks every built-in instrument except External MIDI as synthesizable', () => {
    expect(isSynthesizable('default')).toBe(true);
    expect(isSynthesizable('piano')).toBe(true);
    expect(isSynthesizable('drums')).toBe(true);
    expect(isSynthesizable('bass')).toBe(true);
    // External MIDI routes to outboard gear; rendering it internally would be silence.
    expect(isSynthesizable('external')).toBe(false);
  });

  it('rejects unknown instrument ids', () => {
    expect(isSynthesizable('not-a-real-instrument')).toBe(false);
    expect(isSynthesizable(undefined)).toBe(false);
  });

  it('resolves a usable instrument for any id so the UI never renders undefined', () => {
    expect(getInstrument('piano').name).toBe('Grand Piano');
    expect(getInstrument('bogus')).toBe(INSTRUMENTS[0]);
    expect(getInstrument(undefined).name).toBeTruthy();
  });

  it('gives every instrument an id, name and description', () => {
    INSTRUMENTS.forEach(inst => {
      expect(inst.id).toBeTruthy();
      expect(inst.name).toBeTruthy();
      expect(inst.desc).toBeTruthy();
    });
  });
});
