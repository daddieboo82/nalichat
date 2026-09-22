// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase immersion shell',()=>{
  it('carries world atmosphere into storefront interiors',async()=>{
    const layout=await read('components/layout/AppLayout.jsx');
    const atmosphere=await read('components/layout/WorldAtmosphere.jsx');
    expect(layout).toContain('<WorldAtmosphere />');
    expect(layout).toContain('<WorldContinuityBar />');
    expect(atmosphere).toContain('resolveWorldForLocation');
  });
  it('brands global navigation as NaliBase',async()=>{
    const desktop=await read('components/navigation/DesktopNav.jsx');
    const mobile=await read('components/navigation/MobileHeader.jsx');
    expect(desktop).toContain('>NaliBase</span>');
    expect(mobile).toContain('>NaliBase</span>');
    expect(mobile).toContain('"NaliBase";');
  });
});
