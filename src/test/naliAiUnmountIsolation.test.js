// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai unmount isolation', () => {
  it('invalidates pending sends and network refresh callbacks during unmount', async () => {
    const source = await read();
    const start = source.indexOf('// Unmount invalidates all outstanding sends, restores, and refreshes.');
    const end = source.indexOf('// Speech generation is asynchronous.', start);
    expect(start).toBeGreaterThan(0);
    const cleanup = source.slice(start, end);
    for (const guard of [
      'identityGenerationRef.current += 1;',
      'sendSequenceRef.current += 1;',
      'sendInFlightRef.current = false;',
      'pendingAssistantBaselineRef.current = null;',
      'replyRefreshInFlightRef.current = false;',
      'conversationInitRef.current = null;',
      'unsubRef.current?.();',
      'clearTimeout(loadingTimerRef.current);',
    ]) expect(cleanup).toContain(guard);
  });
  it('keeps response callbacks scoped to an active request and identity', async () => {
    const source = await read();
    expect(source).toContain('if (generation !== identityGenerationRef.current || requestSequence !== sendSequenceRef.current) throw staleIdentityError();');
    expect(source).toContain('requestSequence !== sendSequenceRef.current || !sendInFlightRef.current || conversationRef.current?.id !== conv.id');
    expect(source).toContain('if (generation !== identityGenerationRef.current) return;');
  });
  it('does not cancel an active request simply because the panel closes', async () => {
    const source = await read();
    expect(source).toContain('setOpen(false); }} aria-label="Close"');
    expect(source).toContain('setMinimized(v => !v); }} aria-label={minimized ? "Restore" : "Minimize"}');
    expect(source).toContain('clearTimeout(focusTimerRef.current); focusTimerRef.current = null;');
    const cleanup = source.slice(source.indexOf('// Unmount invalidates'), source.indexOf('// Speech generation is asynchronous.'));
    expect(cleanup).not.toContain('setOpen(');
    expect(cleanup).not.toContain('setMinimized(');
  });
});
