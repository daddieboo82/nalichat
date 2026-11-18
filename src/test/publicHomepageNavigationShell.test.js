// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public homepage navigation shell', () => {
  it('does not duplicate the public homepage navigation or reserve bottom-tab space', () => {
    const layout = readFileSync('src/components/layout/AppLayout.jsx', 'utf8');
    expect(layout).toContain("const isPublicHome = location.pathname === '/' && authChecked && !user;");
    expect(layout).toContain('!isDesktop && !isPublicHome && <MobileHeader />');
    expect(layout).toContain('!isDesktop && !isPublicHome && <MobileNav />');
    expect(layout).toContain('isDesktop && !isPublicHome && (');
    expect(layout).toContain("isPublicHome ? 'pb-0'");
    const home = readFileSync('src/pages/Home.jsx', 'utf8');
    expect(home).toContain('aria-label="Main navigation"');
    expect(home).toContain('Create your free account');
  });
});
