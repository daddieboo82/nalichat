// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('contacts message navigation', () => {
  it('waits for DM creation before switching back to chats', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('const [sidebarTab, setSidebarTab] = useState("contacts");');
    expect(source).toContain('isFetched: conversationsFetched');
    expect(source).toContain('!location.search || !conversationsFetched');
    expect(source).toContain('onMessageContact={async (u) => {');
    expect(source).toContain('await startDM(u);');
    expect(source.indexOf('await startDM(u);')).toBeLessThan(
      source.indexOf('setSidebarTab("chats");'),
    );
    expect(source).toContain('} catch {}');
    expect(source).toContain('queryClient.setQueryData(["conversations", currentUser?.id]');
    expect(source).toContain('return [conv, ...rows];');

    const startDm = source.slice(
      source.indexOf('const startDM = async'),
      source.indexOf('const createGroup = async'),
    );
    const cacheSeed = startDm.indexOf('queryClient.setQueryData(["conversations", currentUser?.id]');
    const navigation = startDm.indexOf('handleSelectConv(conv.id);');
    const criticalSection = startDm.slice(cacheSeed, navigation);
    expect(criticalSection).not.toContain('invalidateQueries');
  });
});
