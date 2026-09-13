import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio Editor mastering contract', () => {
  it('rejects backend error and incomplete mastering payloads', async () => {
    const s = await readFile('src/pages/StudioEditor.jsx', 'utf8');
    expect(s).toContain('if (result?.data?.error) throw new Error(result.data.error);');
    expect(s).toContain('AI mastering response was incomplete');
    expect(s).not.toContain('audio_url: audioUrl');
  });
});
