import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('registration campaign attribution', () => {
  it('captures marketing attribution when ads land directly on registration', () => {
    const register = fs.readFileSync('src/pages/Register.jsx', 'utf8');
    expect(register).toContain('captureMarketingAttribution');
    expect(register).toContain('useEffect(() =>');
    expect(register).toContain('captureMarketingAttribution();');
  });
});
