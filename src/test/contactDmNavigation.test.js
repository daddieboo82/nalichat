// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('contacts message navigation', () => {
  it('waits for DM creation before switching back to chats', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('onMessageContact={async (u) => {');
    expect(source).toContain('await startDM(u);');
    expect(source.indexOf('await startDM(u);')).toBeLessThan(
      source.indexOf('setSidebarTab("chats");'),
    );
    expect(source).toContain('} catch {}');
  });
});
