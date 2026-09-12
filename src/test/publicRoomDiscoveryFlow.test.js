// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public room discovery flow', () => {
  it('contains failures and blocks duplicate room actions', async () => {
    const source = await readText('src/components/messages/ConversationList.jsx');

    expect(source).toContain('const [pendingRoomId, setPendingRoomId] = useState(null);');
    expect(source).toContain('if (pendingRoomId) return;');
    expect(source).toContain('disabled={!!pendingRoomId}');
    expect(source).toContain('toast.error("Couldn\'t open the public room. Please try again.");');
    expect(source.indexOf('setSearch("");', source.indexOf('onSelect(roomId);'))).toBeGreaterThan(
      source.indexOf('onSelect(roomId);'),
    );
    expect(source).toContain('finally {');
    expect(source).toContain('setPendingRoomId(null);');
  });
});
