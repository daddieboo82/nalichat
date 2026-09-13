import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Viral Moment reel validation', () => {
  it('validates AI reel output on both server and client', async () => {
    const server = await readFile('base44/functions/generate-viral-moment/entry.ts', 'utf8');
    const client = await readFile('src/components/messages/ViralMomentDialog.jsx', 'utf8');
    expect(server).toContain("throw new Error('INVALID_REEL_CONCEPT')");
    expect(server).toContain("AI returned an invalid reel concept");
    expect(server).toContain('scenes.length < 3');
    expect(client).toContain('response.data.scenes.length < 3');
    expect(client).toContain('Nali returned an incomplete reel script. Try again!');
  });
});
