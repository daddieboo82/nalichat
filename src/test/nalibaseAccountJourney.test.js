// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase account journey',()=>{
 it('uses NaliBase for auth and account-level copy',async()=>{ expect(await read('lib/authErrorMessages.js')).toContain('Could not reach NaliBase'); expect(await read('components/settings/DeleteAccountDialog.jsx')).toContain('your NaliBase account'); });
 it('welcomes and invites users into NaliBase',async()=>{ expect(await read('components/onboarding/WelcomeTour.jsx')).toContain('Welcome to NaliBase!'); expect(await read('components/GlobalInviteDialog.jsx')).toContain('Join NaliBase'); });
});
