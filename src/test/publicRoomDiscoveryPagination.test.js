import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public room discovery pagination', () => {
  it('loads all public rooms instead of silently capping discovery at 200', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('queryKey: ["public-conversations"]');
    expect(s).toContain('queryFn: () => filterAll(');
    expect(s).toContain('{ type: "group", is_public: true }');
    expect(s).not.toContain('{ type: "group", is_public: true },\n      "-last_message_at",\n      200,');
  });
});
