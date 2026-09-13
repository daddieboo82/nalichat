// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('global provider account-switch races', () => {
  it('does not commit locked-chat mutation results after an identity change', async () => {
    const source = await readFile('src/lib/LockedChatsContext.jsx', 'utf8');
    expect(source).toContain('const generation = lockGenerationRef.current;');
    expect(source).toContain('Locked chats changed accounts before the update completed.');
    expect(source).toContain('const result = await configureLockedChatPin(pin, user?.id);');
    expect(source).toContain('const result = await completeLockedChatPinReset(code, pin, user?.id);');
    expect(source).toContain('const result = await setLockedConversation(conversationId, locked, user?.id);');
  });

  it('does not roll back Nali Presence with a previous account save result', async () => {
    const source = await readFile('src/lib/NaliPresenceContext.jsx', 'utf8');
    expect(source).toContain('const identityGenerationRef = useRef(0);');
    expect(source).toContain('identityGenerationRef.current += 1;');
    expect(source).toContain('const generation = identityGenerationRef.current;');
    expect(source).toContain('if (generation !== identityGenerationRef.current) return;');
    expect(source).toContain('if (generation === identityGenerationRef.current)');
  });
});
