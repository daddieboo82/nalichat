// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai recovery is scoped to the request that started it', () => {
  it('assigns a unique sequence to each pending send and invalidates previous recovery work', async () => {
    const source = await read();
    expect(source).toContain('const sendSequenceRef = useRef(0);');
    expect(source).toContain('const requestSequence = ++sendSequenceRef.current;');
    expect(source).toContain('sendSequenceRef.current += 1;');
    expect(source).toContain('replyRefreshInFlightRef.current = false;');
  });
  it('rejects old one-minute timeout reads before and after fetching history', async () => {
    const source = await read();
    expect(source.match(/requestSequence !== sendSequenceRef\.current \|\| !sendInFlightRef\.current/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('if (generation !== identityGenerationRef.current || requestSequence !== sendSequenceRef.current) throw staleIdentityError();');
  });
  it('does not allow a stale reconnect fetch or exception to mutate a new request', async () => {
    const source = await read();
    expect(source).toContain('const requestSequence = sendSequenceRef.current;');
    expect(source).toContain('requestSequence !== sendSequenceRef.current || !sendInFlightRef.current || conversationRef.current?.id !== conv.id');
    expect(source).toContain('requestSequence === sendSequenceRef.current && sendInFlightRef.current && !quiet');
    expect(source).toContain('requestSequence === sendSequenceRef.current) replyRefreshInFlightRef.current = false;');
  });
});
