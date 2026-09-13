// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile auth and picker viewport safety', () => {
  it('keeps auth forms reachable on short mobile viewports', async () => {
    const auth = await readFile('src/components/AuthLayout.jsx', 'utf8');
    expect(auth).toContain('min-h-[100dvh]');
    expect(auth).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
    expect(auth).toContain('env(safe-area-inset-top)');
    expect(auth).toContain('env(safe-area-inset-bottom)');
  });

  it('uses native touch scrolling in long user/report picker lists', async () => {
    const files = [
      'src/components/GlobalMessageDialog.jsx',
      'src/components/ReportContentDialog.jsx',
      'src/components/messages/NewChatDialog.jsx',
      'src/components/messages/GroupChatDialog.jsx',
    ];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source).toContain('[-webkit-overflow-scrolling:touch]');
    }
  });
});
