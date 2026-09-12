// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('global message idempotent retry', () => {
  it('reuses the same client message key for the same recipient and text', async () => {
    const source = await readText('src/components/GlobalMessageDialog.jsx');

    expect(source).toContain('createClientMessageKey');
    expect(source).toContain('retrySignatureRef.current === signature');
    expect(source).toContain('client_message_key: clientMessageKey');
    expect(source).toContain('retryKeyRef.current = null;');
  });
});
