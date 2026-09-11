// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message reaction failure feedback', () => {
  it('restores optimistic state and surfaces backend failures', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('queryClient.setQueryData(["messages", selectedConvId], previous);');
    expect(source).toContain('toast.error("You are timed out and cannot react to messages right now.")');
    expect(source).toContain('toast.error("You cannot react to messages while your account is banned.")');
    expect(source).toContain('toast.error("Couldn\'t update the reaction. Please try again.")');
  });
});
