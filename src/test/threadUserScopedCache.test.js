// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('ThreadPanel user-scoped cache', () => {
  it('isolates replies by user and gates private reads on auth', async () => {
    const source = await readText('src/components/messages/ThreadPanel.jsx');

    expect(source).toContain('queryKey: ["thread", currentUser?.id, parentMessage.id]');
    expect(source).toContain('enabled: !!currentUser?.id && !!parentMessage?.id');
    expect(source).toContain('queryKey: ["messages", currentUser?.id]');
    expect(source).not.toContain('queryKey: ["thread", parentMessage.id]');
    expect(source).not.toContain('queryKey: ["messages"]');
  });
});
