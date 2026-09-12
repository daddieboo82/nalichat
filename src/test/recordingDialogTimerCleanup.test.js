// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('recording and dialog timer cleanup', () => {
  it('tracks and clears the recording guide auto-stop timer', async () => {
    const source = await readText('src/components/record/RecordingGuide.jsx');
    expect(source).toContain('const practiceStopTimerRef = useRef(null);');
    expect(source).toContain('if (practiceStopTimerRef.current) clearTimeout(practiceStopTimerRef.current);');
    expect(source).toContain('practiceStopTimerRef.current = setTimeout');
  });

  it('cancels stale Track Commit close timers on unmount and reopen', async () => {
    const source = await readText('src/components/studio/TrackCommitDialog.jsx');
    expect(source).toContain('const closeTimerRef = useRef(null);');
    expect(source).toContain('if (closeTimerRef.current) clearTimeout(closeTimerRef.current);');
    expect(source).toContain('if (nextOpen && closeTimerRef.current)');
    expect(source).toContain('<Dialog open={open} onOpenChange={handleOpenChange}>');
  });
});
