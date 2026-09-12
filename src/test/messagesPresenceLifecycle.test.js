import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages presence lifecycle', () => {
  it('does not mark the user offline when switching conversations', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain('const selectedConvIdRef = useRef(null);');
    expect(source).toContain('selectedConvIdRef.current = selectedConvId;');
    expect(source).toContain('queryKey: ["messages", currentUser?.id, selectedConvIdRef.current]');
    expect(source).toContain('}, [currentUser?.id, queryClient]);');
    expect(source).not.toContain('}, [currentUser, queryClient, selectedConvId]);');
  });
});
