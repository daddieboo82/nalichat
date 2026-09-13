// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages panel query errors', () => {
  it('distinguishes thread/session load failures from empty content', async () => {
    const thread = await readText('src/components/messages/ThreadPanel.jsx');
    const session = await readText('src/components/messages/ChatSessionViewer.jsx');

    expect(thread).toContain('isError: repliesError');
    expect(thread).toContain("Couldn't load thread replies.");
    expect(session).toContain('const [tracksError, setTracksError] = useState(false);');
    expect(session).toContain("Couldn't load session tracks. The app will retry automatically.");
    expect(session).toContain('setTracksError(false);');
  });
});
