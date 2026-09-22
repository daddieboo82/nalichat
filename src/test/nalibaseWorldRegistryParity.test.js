import { describe, expect, it } from 'vitest';
import { WORLD_CONTEXTS, WORLD_ORDER } from '../lib/nalibaseWorldContext.js';
import { NALIBASE_ARCHITECTURE } from '../lib/nalibaseArchitecture.js';
describe('NaliBase world registry parity',()=>{
 it('keeps one canonical ordered set of exactly six worlds',()=>{ expect(WORLD_ORDER).toEqual(['connect','create','discover','share','visualize','compete']); expect(Object.keys(WORLD_CONTEXTS).sort()).toEqual([...WORLD_ORDER].sort()); });
 it('keeps architecture and navigation context in sync',()=>{ expect(Object.keys(NALIBASE_ARCHITECTURE.worlds).sort()).toEqual([...WORLD_ORDER].sort()); for (const id of WORLD_ORDER) { expect(WORLD_CONTEXTS[id].path).toBe(`/world/${id}`); expect(WORLD_CONTEXTS[id].storefronts).toHaveLength(4); } });
});
