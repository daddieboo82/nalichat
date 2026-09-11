// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message search structured errors', () => {
  it('treats backend error payloads as failures for initial and paginated searches', async () => {
    const source = await readText('src/components/messages/MessageSearch.jsx');

    expect(source.match(/if \(response\?\.data\?\.error\) throw new Error\(response\.data\.error\);/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
