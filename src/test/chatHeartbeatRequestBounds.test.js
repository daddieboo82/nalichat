// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('chat heartbeat request bounds', () => {
  it('validates read receipts and typing heartbeats before service-role work', async () => {
    const read = await readText('base44/functions/markMessageRead/entry.ts');
    const typing = await readText('base44/functions/updateTypingStatus/entry.ts');

    for (const source of [read, typing]) {
      expect(source).toContain("req.method !== 'POST'");
    }

    expect(read).toContain('messageId.length > 256');
    expect(read.indexOf('messageId.length > 256')).toBeLessThan(
      read.indexOf("'message_read_receipt'"),
    );

    expect(typing).toContain('conversationId.length > 256');
    expect(typing.indexOf('conversationId.length > 256')).toBeLessThan(
      typing.indexOf("'typing_status'"),
    );
  });
});
