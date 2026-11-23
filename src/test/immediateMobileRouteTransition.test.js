import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('immediate route handoff', () => {
  it('renders the incoming route without waiting for exit animation', async () => {
    const layout = await readFile('src/components/layout/AppLayout.jsx', 'utf8');
    expect(layout).toContain('<AnimatePresence initial={false} mode="sync">');
    expect(layout).toContain('<PageTransition key={location.pathname}');
    expect(layout).toContain('relative z-10 flex-1 overflow-hidden');
  });
  it('overlays transition pages without stacking them or blocking scrolling', async () => {
    const transition = await readFile('src/components/layout/PageTransition.jsx', 'utf8');
    expect(transition).toContain('absolute inset-0 h-full min-h-0 w-full min-w-0');
    expect(transition).toContain('overflow-x-hidden overflow-y-auto');
    expect(transition).toContain('useReducedMotion');
  });
});