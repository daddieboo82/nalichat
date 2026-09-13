import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('messaging backend SDK alignment', () => {
  it('uses the current Base44 SDK across messaging, push, and share endpoints', async () => {
    const paths = [
      'base44/functions/updateUserPresence/entry.ts',
      'base44/functions/markMessageRead/entry.ts',
      'base44/functions/registerPushSubscription/entry.ts',
      'base44/functions/unregisterPushSubscription/entry.ts',
      'base44/functions/notifyOnMessage/entry.ts',
      'base44/functions/sendExternalMessage/entry.ts',
      'base44/functions/getSharedFileByToken/entry.ts',
      'base44/functions/createFileShareLink/entry.ts',
    ];
    for (const path of paths) {
      const source = await readFile(path, 'utf8');
      expect(source).toContain('npm:@base44/sdk@0.8.44');
      expect(source).not.toContain('npm:@base44/sdk@0.8.31');
    }
  });
});
