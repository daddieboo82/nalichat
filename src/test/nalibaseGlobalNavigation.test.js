// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase global navigation',()=>{
  it('desktop navigation leads with all six world malls',async()=>{
    const s=await read('components/navigation/DesktopNav.jsx');
    for(const w of ['connect','create','discover','share','visualize','compete']) expect(s).toContain('/world/'+w);
    expect(s).toContain('NaliBase Worlds');
  });
  it('mobile menu is a mall directory instead of a flat feature catalog',async()=>{
    const s=await read('components/navigation/MobileHeader.jsx');
    expect(s).toContain('Enter a NaliBase Mall');
    expect(s).toContain('NaliBase malls and account navigation');
  });
  it('mobile bottom navigation keeps the plaza and primary malls one tap away',async()=>{
    const s=await read('components/navigation/MobileNav.jsx');
    expect(s).toContain('label: "Plaza"');
    expect(s).toContain('label: "Connect"');
    expect(s).toContain('label: "Create"');
    expect(s).toContain('label: "Discover"');
    expect(s).toContain('label: "Visualize"');
    expect(s).toContain('label: "Compete"');
  });
});
