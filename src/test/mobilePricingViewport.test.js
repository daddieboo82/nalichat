// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile pricing viewport scrolling', () => {
  it('keeps both pricing states on native touch scrollers', async () => {
    const source = await readFile('src/components/pricing/PricingPlans.jsx', 'utf8');
    const marker = 'h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background';
    expect(source.split(marker).length - 1).toBeGreaterThanOrEqual(2);
  });
});
