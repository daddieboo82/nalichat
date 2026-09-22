// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase lifecycle product copy',()=>{
 it('onboards stalled users into the world model',async()=>{ const s=await read('base44/functions/reengageStalledUsers/entry.ts'); expect(s).toContain('NaliBase worlds for creating, connecting, discovering, sharing, visualizing, and competing'); });
 it('uses umbrella branding for generic donations and settings cancellation',async()=>{ const checkout=await read('base44/functions/createCheckout/entry.ts'); const cancel=await read('base44/functions/cancelPayPalSubscription/entry.ts'); expect(checkout).toContain("Donation to NaliBase"); expect(cancel).toContain('NaliBase Settings'); });
});
