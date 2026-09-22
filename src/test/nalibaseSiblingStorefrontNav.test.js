// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase sibling storefront navigation',()=>{
 it('defines four storefront shortcuts for every mall',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); expect((s.match(/storefronts:/g)||[]).length).toBe(6); expect((s.match(/label:/g)||[]).length).toBeGreaterThanOrEqual(30); });
 it('keeps sibling storefronts and the plaza reachable from interiors',async()=>{ const s=await read('components/layout/WorldContinuityBar.jsx'); expect(s).toContain('world.storefronts'); expect(s).toContain('aria-label={`${world.label} storefronts`}'); expect(s).toContain('>Plaza</Link>'); });
});
