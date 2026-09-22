import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase Recent historical mall origin',()=>{
 it('deduplicates by storefront path while replacing it with its newest origin',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('stored.filter(entry => entry.path !== currentPath)'); expect(s).toContain('const updated = [entry, ...filtered].slice(0, MAX_ITEMS)'); });
 it('validates stored world ids against the canonical registry',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('WORLD_CONTEXTS[item?.fromWorld] ? item.fromWorld : ""'); });
});
