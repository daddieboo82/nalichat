import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile recent storefronts',()=>{
 it('does not let Central Plaza consume a recent-storefront slot',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('currentPath !== "/" && Object.hasOwn(titles, currentPath)'); expect(s).toContain('entry.path !== "/" && Object.hasOwn(titles, entry.path)'); });
 it('keeps account-scoped storage and the four-storefront cap',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('nali_recent_pages:${userId || "anonymous"}'); expect(s).toContain('const MAX_ITEMS = 4'); });
});
