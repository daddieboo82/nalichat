import { describe, expect, it } from 'vitest';
import { chatKeyboardOffset } from '../lib/chatKeyboardOffset';

describe('mobile direct-message composer keyboard lift', () => {
  it('lifts an overlay keyboard in portrait and landscape', () => {
    expect(chatKeyboardOffset(844, 514, 0)).toBe(330);
    expect(chatKeyboardOffset(390, 180, 0)).toBe(210);
  });

  it('does not double-lift Android when the layout already resized', () => {
    expect(chatKeyboardOffset(514, 514, 0)).toBe(0);
    expect(chatKeyboardOffset(180, 180, 0)).toBe(0);
  });

  it('handles visual viewport offset and ignores minor browser chrome changes', () => {
    expect(chatKeyboardOffset(844, 520, 24)).toBe(300);
    expect(chatKeyboardOffset(844, 800, 0)).toBe(0);
    expect(chatKeyboardOffset(844, 800, 60)).toBe(0);
    expect(chatKeyboardOffset(844, NaN, 0)).toBe(0);
  });
});
