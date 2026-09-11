// @vitest-environment node
import { access } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('orphaned collaboration notifier cleanup', () => {
  it('does not ship the disabled legacy collaboration broadcast function', async () => {
    await expect(
      access(new URL('../../base44/functions/sendCollabNotifications/entry.ts', import.meta.url)),
    ).rejects.toThrow();
  });
});
