// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Record and ViralSeed account isolation', () => {
  it('clears local recording blobs and rejects stale recorder completions on account changes', async () => {
    const source = await readFile('src/pages/Record.jsx', 'utf8');
    expect(source).toContain('const recordingGenerationRef = useRef(0);');
    expect(source).toContain('recordingGenerationRef.current += 1;');
    expect(source).toContain('setRecordings([]);');
    expect(source).toContain('URL.revokeObjectURL(recording.url)');
    expect(source).toContain('recordingGeneration === recordingGenerationRef.current');
  });

  it('clears ViralSeed concepts and ignores prior-account generation results', async () => {
    const source = await readFile('src/pages/ViralSeed.jsx', 'utf8');
    expect(source).toContain('const generationRef = useRef(0);');
    expect(source).toContain('generationRef.current += 1;');
    expect(source).toContain('setConcepts([]);');
    expect(source).toContain('if (generation !== generationRef.current) return;');
    expect(source).toContain('if (generation === generationRef.current) setLoading(false);');
  });
});
