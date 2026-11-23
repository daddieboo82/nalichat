// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai hanging submit recovery', () => {
  it('starts the safety timeout before waiting for the backend invoke', async () => {
    const source = await read();
    const sendStart = source.indexOf('const sendText = async');
    const dispatch = source.indexOf('dispatchStarted = true;', sendStart);
    const timeout = source.indexOf('loadingTimerRef.current = setTimeout(() => {', dispatch);
    const awaitSend = source.indexOf('await sendAgentText(conv, text.trim());', dispatch);
    const catchStart = source.indexOf('} catch (err) {', awaitSend);
    expect(dispatch).toBeGreaterThan(sendStart);
    expect(timeout).toBeGreaterThan(dispatch);
    expect(timeout).toBeLessThan(awaitSend);
    expect(awaitSend).toBeLessThan(catchStart);
    expect(source.slice(dispatch, catchStart).match(/loadingTimerRef\.current = setTimeout\(/g)).toHaveLength(1);
  });
  it('only refreshes the existing conversation and ignores settled or old sends', async () => {
    const source = await read();
    const start = source.indexOf('loadingTimerRef.current = setTimeout(() => {', source.indexOf('const sendText = async'));
    const timer = source.slice(start, source.indexOf('}, 60000);', start));
    expect(timer).toContain('generation !== identityGenerationRef.current');
    expect(timer).toContain('requestSequence !== sendSequenceRef.current');
    expect(timer).toContain('!sendInFlightRef.current');
    expect(timer).toContain('void refreshPendingReply({ quiet: true });');
    expect(timer).not.toContain('sendAgentText(');
  });
});
