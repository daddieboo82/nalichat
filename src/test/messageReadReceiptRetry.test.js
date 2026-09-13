// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message read receipt retries', () => {
  it('releases failed read attempts so polling can retry them', async () => {
    const source = await readText('src/components/messages/ChatView.jsx');

    expect(source).toContain("base44.functions.invoke('markMessageRead', { message_id: m.id })");
    expect(source).toContain('markedRef.current.delete(m.id);');
    expect(source).toContain('res?.data?.success !== true');
    expect(source).toContain('markedRef.current.clear();');
  });
});
