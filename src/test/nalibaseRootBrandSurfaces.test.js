// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase root product surfaces',()=>{
 it('loads as NaliBase',async()=>expect(await read('components/layout/AppLoader.jsx')).toContain('>NaliBase<'));
 it('registers and onboards into NaliBase',async()=>{ expect(await read('pages/Register.jsx')).toContain('Join NaliBase free'); const o=await read('pages/Onboarding.jsx'); expect(o).toContain('Welcome to NaliBase'); expect(o).toContain('Enter NaliBase'); });
 it('uses NaliBase for cross-world AI and plans',async()=>{ expect(await read('components/nali/NaliProactivitySettings.jsx')).toContain('across NaliBase'); expect(await read('components/pricing/PricingPlans.jsx')).toContain('NaliBase plans'); });
});
