// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('non-text message send contract', () => {
  it('awaits attachment, voice, and session dispatch before clearing composer context', async () => {
    const source = await readText('src/components/messages/ChatInput.jsx');

    expect(source.match(/await Promise\.resolve\(onSend\(payload\)\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('const sendSession = async () =>');
    expect(source).toContain("onKeyDown={async e => {");
    expect(source).toContain('await sendSession();');
    expect(source).toContain('The upload itself succeeded.');
  });
});
