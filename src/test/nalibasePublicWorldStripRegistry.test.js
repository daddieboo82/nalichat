import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('public NaliBase world strip',()=>{it('uses the same registry-driven Plaza world collection',async()=>{const s=await read('pages/Home.jsx');expect(s).toContain('PLAZA_WORLDS.map(({ id, title, icon: WorldIcon, gradient })');for(const literal of ['["CONNECT", MessageSquare','["CREATE", Music','["DISCOVER", Sparkles','["SHARE", FolderKanban','["VISUALIZE", Video','["COMPETE", Trophy'])expect(s).not.toContain(literal);});});
