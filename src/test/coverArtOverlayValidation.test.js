// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Cover Art overlay validation',()=>{it('validates overlay images before creating previews',async()=>{const s=await readFile('src/pages/CoverArt.jsx','utf8');const label=s.indexOf('Add Overlay Image');const v=s.indexOf('validateUpload(selected, { accept: "image" })',label);const p=s.indexOf('URL.createObjectURL(selected)',label);expect(v).toBeGreaterThan(label);expect(p).toBeGreaterThan(v);});});
