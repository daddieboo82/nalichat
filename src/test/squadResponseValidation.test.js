import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('squad response validation', () => {
  it('requires confirmed create and leave responses', async () => {
    const s = await readFile('src/pages/Squad.jsx', 'utf8');
    expect(s).toContain('Squad invite creation was not confirmed');
    expect(s).toContain('Squad update was not confirmed');
  });
});
