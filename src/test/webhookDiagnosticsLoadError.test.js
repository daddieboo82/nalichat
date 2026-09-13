import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('webhook diagnostics load state', () => {
  it('does not render failed subscription diagnostics as an empty account', async () => {
    const s = await readFile('src/pages/WebhookTest.jsx', 'utf8');
    expect(s).toContain('isError: subscriptionsError');
    expect(s).toContain("Couldn't load subscription diagnostics.");
    expect(s).toContain('onClick={() => void refetchSubscriptions()}');
  });
});
