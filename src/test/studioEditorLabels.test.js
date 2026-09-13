import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio Editor product labels', () => {
  it('does not overstate analysis-only mastering capabilities', async () => {
    const s = await readFile('src/pages/StudioEditor.jsx', 'utf8');
    expect(s).toContain('Studio Mastering Editor');
    expect(s).toContain('Analyze with AI');
    expect(s).toContain('AI Suggested');
    expect(s).not.toContain('Award-Winning Studio Editor');
    expect(s).not.toContain('Industry Standard');
  });
});
