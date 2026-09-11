// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages user directory errors', () => {
  it('surfaces structured public-user query failures', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('isError: usersError');
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(source).toContain("Couldn't load people. Names and new-chat discovery may be unavailable until you refresh.");
  });
});
