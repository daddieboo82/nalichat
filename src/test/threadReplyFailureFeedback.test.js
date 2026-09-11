// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('thread reply failure feedback', () => {
  it('keeps the draft and surfaces specific send failures', async () => {
    const source = await readText('src/components/messages/ThreadPanel.jsx');

    expect(source).toContain('toast.error("Thread reply blocked by content moderation. Your draft was kept.")');
    expect(source).toContain('toast.error("You are timed out and cannot reply right now. Your draft was kept.")');
    expect(source).toContain('toast.error("You cannot reply in this thread while your account is banned.")');
    expect(source).toContain('toast.error("Thread reply failed. Your draft was kept so you can retry.")');
    expect(source.indexOf('setText("");')).toBeGreaterThan(source.indexOf('onSuccess: () =>'));
  });
});
