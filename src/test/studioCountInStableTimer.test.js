import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio stable and cancelable record count-in', () => {
  it('does not reschedule the beat timer every time the completion callback rerenders', async () => {
    const source = await readFile('src/components/studio/CountInIndicator.jsx', 'utf8');
    expect(source).toContain('onCompleteRef.current = onComplete');
    expect(source).toContain('if (!canceled) onCompleteRef.current?.()');
    expect(source).toContain('[active, beatsPerBar, bpm, audioCtxRef]');
    expect(source).not.toContain('[active, beatsPerBar, bpm, onComplete, audioCtxRef]');
  });
  it('cancels scheduled ticks and completion on deactivate or unmount', async () => {
    const source = await readFile('src/components/studio/CountInIndicator.jsx', 'utf8');
    expect(source).toContain('let canceled = false');
    expect(source).toContain('if (canceled) return;');
    expect(source).toContain('canceled = true;');
    expect(source).toContain('clearTimeout(completionTimerRef.current)');
    expect(source).toContain('cancelAnimationFrame(rafRef.current)');
  });
  it('closes only an internally owned metronome AudioContext', async () => {
    const source = await readFile('src/components/studio/CountInIndicator.jsx', 'utf8');
    expect(source).toContain('const ownsAudioContext = !audioCtxRef?.current');
    expect(source).toContain("if (ownsAudioContext && ctx.state !== 'closed') void ctx.close().catch(() => {});");
  });
  it('does not accept a count-in callback after the parent canceled recording', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = source.slice(source.indexOf('const handleCountInComplete ='), source.indexOf('// Keyboard shortcuts', source.indexOf('const handleCountInComplete =')));
    expect(block).toContain('if (!countInActive) return');
  });
});
