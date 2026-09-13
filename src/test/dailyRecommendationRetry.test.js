import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Daily Pick retry', () => {
  it('shows a recoverable error instead of silently disappearing', async () => {
    const s = await readFile('src/components/home/DailyRecommendation.jsx', 'utf8');
    expect(s).toContain('const [loadError, setLoadError] = useState(false);');
    expect(s).toContain('const [retryKey, setRetryKey] = useState(0);');
    expect(s).toContain('Daily Pick couldn\'t load.');
    expect(s).toContain('setRetryKey((value) => value + 1)');
    expect(s).not.toContain('.catch(() => {});');
  });
});
