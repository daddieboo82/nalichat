import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('moderation presence cleanup', () => {
  for (const path of [
    'base44/functions/sendConversationMessage/entry.ts',
    'base44/functions/mutateConversationMessage/entry.ts',
  ]) {
    it(`${path} clears online presence when a timeout or ban is applied`, async () => {
      const s = await readFile(path, 'utf8');
      const moderation = s.indexOf('if (timeout_until || is_banned)');
      const offline = s.indexOf('is_online: false', moderation);
      const lastSeen = s.indexOf('last_seen: new Date().toISOString()', moderation);
      expect(moderation).toBeGreaterThan(-1);
      expect(offline).toBeGreaterThan(moderation);
      expect(lastSeen).toBeGreaterThan(offline);
    });
  }
});
