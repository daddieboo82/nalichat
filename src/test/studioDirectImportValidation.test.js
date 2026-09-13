// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio direct import validation',()=>{it('validates imported audio before creating an object URL',async()=>{const s=await readFile('src/pages/Studio.jsx','utf8');const h=s.indexOf('const handleFileChange');const v=s.indexOf('validateUpload(file, { accept: "audio" })',h);const p=s.indexOf('URL.createObjectURL(file)',h);expect(v).toBeGreaterThan(h);expect(p).toBeGreaterThan(v);});});
