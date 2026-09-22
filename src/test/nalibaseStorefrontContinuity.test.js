// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getWorldForPath } from '../lib/nalibaseWorldContext';
import { readFile } from 'node:fs/promises';

describe('NaliBase storefront continuity', () => {
  it('maps storefront routes back to their mall', () => {
    expect(getWorldForPath('/messages')?.id).toBe('connect');
    expect(getWorldForPath('/studio')?.id).toBe('create');
    expect(getWorldForPath('/explore')?.id).toBe('discover');
    expect(getWorldForPath('/files')?.id).toBe('share');
    expect(getWorldForPath('/music-video-generator')?.id).toBe('visualize');
    expect(getWorldForPath('/challenges')?.id).toBe('compete');
    expect(getWorldForPath('/settings')).toBeNull();
  });
  it('mounts persistent mall continuity in the application shell', async () => {
    const layout=await readFile(new URL('../components/layout/AppLayout.jsx',import.meta.url),'utf8');
    const bar=await readFile(new URL('../components/layout/WorldContinuityBar.jsx',import.meta.url),'utf8');
    expect(layout).toContain('<WorldContinuityBar />');
    expect(bar).toContain('storefront interior');
    expect(bar).toContain('NaliBase');
  });
});
