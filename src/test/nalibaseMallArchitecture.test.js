// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { NALIBASE_ARCHITECTURE } from '../lib/nalibaseArchitecture';

describe('NaliBase mall architecture', () => {
  it('defines NaliBase as plaza, six malls, storefronts, and experiences', () => {
    expect(NALIBASE_ARCHITECTURE.hubRole).toBe('central_plaza');
    expect(NALIBASE_ARCHITECTURE.worldRole).toBe('mall');
    expect(NALIBASE_ARCHITECTURE.featureRole).toBe('storefront');
    expect(NALIBASE_ARCHITECTURE.experienceRole).toBe('inside_store');
    expect(Object.keys(NALIBASE_ARCHITECTURE.worlds)).toEqual(['connect','create','discover','share','visualize','compete']);
    Object.values(NALIBASE_ARCHITECTURE.worlds).forEach((stores) => expect(stores).toHaveLength(4));
  });
  it('presents each world as a mall with storefront navigation', async () => {
    const source=await readFile(new URL('../pages/WorldHub.jsx', import.meta.url),'utf8');
    expect(source).toContain('Inside the mall');
    expect(source).toContain('Walk the concourse. Choose a storefront.');
    expect(source).toContain('Storefront {String(index+1)');
    expect(source).toContain('Mall open · {world.title}');
  });
});
