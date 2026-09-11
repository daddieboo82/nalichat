// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('thread reply retry behavior', () => {
  it('uses idempotency keys and preserves drafts until send succeeds', async () => {
    const source = await readText('src/components/messages/ThreadPanel.jsx');

    expect(source).toContain('createClientMessageKey');
    expect(source).toContain('client_message_key: clientMessageKey');
    expect(source).toContain('clientMessageKey: createClientMessageKey()');
    expect(source).toContain('if (!trimmed || sendMutation.isPending) return');
    expect(source.indexOf('setText("")')).toBeGreaterThan(
      source.indexOf('onSuccess: () =>'),
    );
  });
});
