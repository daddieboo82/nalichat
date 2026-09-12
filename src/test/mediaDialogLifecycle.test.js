// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('media dialog lifecycle cleanup', () => {
  it('cleans track commit close timers on close and unmount', async () => {
    const source = await readText('src/components/studio/TrackCommitDialog.jsx');
    expect(source).toContain('const closeTimerRef = useRef(null);');
    expect(source).toContain('if (closeTimerRef.current) clearTimeout(closeTimerRef.current);');
    expect(source).toContain('closeTimerRef.current = setTimeout');
  });

  it('cleans recording guide stop timers and object URLs', async () => {
    const source = await readText('src/components/record/RecordingGuide.jsx');
    expect(source).toContain('const practiceStopTimeoutRef = useRef(null);');
    expect(source).toContain('const practiceUrlRef = useRef(null);');
    expect(source).toContain('URL.revokeObjectURL(practiceUrlRef.current);');
    expect(source).toContain('practiceStopTimeoutRef.current = setTimeout');
  });
});
