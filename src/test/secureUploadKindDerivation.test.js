import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('secure upload kind derivation', () => {
  it('does not trust the request kind to raise file size limits', async () => {
    const s = await readFile('base44/functions/secureUploadFile/entry.ts', 'utf8');
    expect(s).toContain('function kindFor(file: File)');
    expect(s).toContain("const kind = kindFor(file);");
    expect(s).not.toContain("form.get('kind')");
    expect(s).toContain("type.startsWith('video/')");
    expect(s).toContain("['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']");
  });
});
