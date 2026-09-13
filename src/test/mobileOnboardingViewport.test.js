// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile onboarding viewport safety', () => {
  it('keeps profile setup reachable on short mobile viewports and keyboards', async () => {
    const page = await readFile('src/pages/Onboarding.jsx', 'utf8');
    expect(page).toContain('min-h-[100dvh]');
    expect(page).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
    expect(page).toContain('env(safe-area-inset-top)');
    expect(page).toContain('env(safe-area-inset-bottom)');
  });

  it('allows the immersive intro to scroll on short screens', async () => {
    const intro = await readFile('src/components/onboarding/ImmersiveOnboarding.jsx', 'utf8');
    expect(intro).toContain('min-h-[100dvh]');
    expect(intro).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
    expect(intro).toContain('env(safe-area-inset-top)');
    expect(intro).toContain('env(safe-area-inset-bottom)');
  });
});
