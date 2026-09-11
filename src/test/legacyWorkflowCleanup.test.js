// @vitest-environment node
import { access } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('legacy workflow cleanup', () => {
  it('does not ship redundant no-op content alert workflows', async () => {
    for (const path of [
      'New File Alert.jsonc',
      'New Track Alert.jsonc',
      'New Message Alert.jsonc',
    ]) {
      await expect(
        access(new URL(`../../base44/workflows/${path}`, import.meta.url)),
      ).rejects.toThrow();
    }
  });
});
