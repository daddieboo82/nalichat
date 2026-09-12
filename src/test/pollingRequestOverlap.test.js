// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('polling request overlap', () => {
  it('serializes typing-status polls', async () => {
    const source = await readText('src/hooks/useTypingIndicator.js');
    expect(source).toContain('let refreshInFlight = false;');
    expect(source).toContain('if (refreshInFlight) return;');
    expect(source).toContain('refreshInFlight = false;');
  });

  it('serializes call-summary polls', async () => {
    const source = await readText('src/hooks/useCallSummary.js');
    expect(source).toContain('const refreshInFlightRef = useRef(false);');
    expect(source).toContain('if (refreshInFlightRef.current) return null;');
    expect(source).toContain('refreshInFlightRef.current = false;');
  });

  it('serializes live-session track polls', async () => {
    const source = await readText('src/components/messages/ChatSessionViewer.jsx');
    expect(source).toContain('let refreshInFlight = false;');
    expect(source).toContain('if (refreshInFlight) return;');
    expect(source).toContain('refreshInFlight = false;');
  });
});
