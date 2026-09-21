import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Studio analytics', () => {
  it('records studio_open only once per mounted Studio instance', () => {
    const source = fs.readFileSync('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain('const studioOpenTrackedRef = useRef(false)');
    expect(source).toContain('if (studioOpenTrackedRef.current) return;');
    expect(source).toContain('studioOpenTrackedRef.current = true;');
  });
});
