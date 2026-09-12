// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('social share window isolation', () => {
  it('opens third-party share pages without opener access or referrer', async () => {
    const source = await readFile('src/components/challenges/ShareButtons.jsx', 'utf8');
    expect(source).toContain('"_blank", "noopener,noreferrer"');
    expect(source.match(/noopener,noreferrer/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
