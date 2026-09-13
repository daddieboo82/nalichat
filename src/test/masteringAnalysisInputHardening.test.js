import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mastering analysis input hardening', () => {
  it('validates export settings against supported values', async () => {
    const s = await readFile('base44/functions/bounceAndMaster/entry.ts', 'utf8');
    expect(s).toContain("ALLOWED_LOUDNESS_TARGETS = new Set(['spotify', 'apple', 'youtube', 'tidal', 'streaming'])");
    expect(s).toContain("ALLOWED_FORMATS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'])");
    expect(s).toContain("ALLOWED_BIT_DEPTHS = new Set(['16bit', '24bit', '32bit'])");
    expect(s).toContain("ALLOWED_SAMPLE_RATES = new Set(['44.1khz', '48khz', '96khz'])");
    expect(s).toContain("Unsupported loudness target");
    expect(s).toContain("Unsupported export format");
  });

  it('keeps silent or near-silent analysis finite', async () => {
    const s = await readFile('base44/functions/bounceAndMaster/entry.ts', 'utf8');
    expect(s).toContain('const nonZeroMagnitudes = Array.from(audioBuffer)');
    expect(s).toContain('nonZeroMagnitudes.length > 0 ? Math.min(...nonZeroMagnitudes) : 1e-10');
    expect(s).toContain('const dynamicRange = Math.max(0, peakDb - minDb)');
  });
});
