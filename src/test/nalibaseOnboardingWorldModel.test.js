// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase onboarding world model',()=>{
 it('teaches new users that Studio belongs to CREATE',async()=>{ const s=await read('components/onboarding/InteractiveWizard.jsx'); expect(s).toContain('NaliStudio inside the CREATE world'); expect(s).not.toContain('NaliChat features a fully-fledged browser DAW'); });
 it('sends completed onboarding into the Plaza',async()=>{ const s=await read('pages/Onboarding.jsx'); expect(s).toContain('enter the NaliBase Plaza'); expect(s).toContain('window.location.href = "/"'); });
});
