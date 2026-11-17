import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio pre-roll handoff and cancellation', () => {
  it('hands off to recording without re-entering pre-roll at the punch point', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const raf = source.slice(source.indexOf('// Pre-roll check:'), source.indexOf('// Post-roll check:'));
    expect(raf).toContain('skipPreRollRef.current = true;');
    expect(raf).toContain('skipCountInRef.current = true;');
    const record = source.slice(source.indexOf('const toggleRecord = async () => {'), source.indexOf('let startupStream = null;'));
    expect(record).toContain('if (!isRecording && preRollWindow.enabled && !skipPreRollRef.current)');
    expect(record).toContain('skipPreRollRef.current = false;');
  });
  it('rejects stale playback-promise completions after Stop or project replacement', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const from = source.indexOf('const preRollRequest = ++preRollRequestRef.current');
    const to = source.indexOf('// One-shot bypass when pre-roll playback',from);
    const block = source.slice(from,to);
    expect(block).toContain('const preRollEpoch = historyEpochRef.current');
    expect(block).toContain('preRollRequestRef.current !== preRollRequest');
    expect(block).toContain('historyEpochRef.current !== preRollEpoch');
    expect(block).toContain('pendingRecordStartRef.current !== recordStartPos');
  });
  it('invalidates pending pre-roll starts when transport Stop is pressed', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const block = source.slice(source.indexOf('const stop = () => {'),source.indexOf('// Called when the count-in overlay'));
    expect(block).toContain('preRollRequestRef.current += 1');
    expect(block).toContain('skipPreRollRef.current = false');
    expect(block).toContain('pendingRecordStartRef.current = null');
  });
});
