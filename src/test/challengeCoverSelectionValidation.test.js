// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('challenge cover selection validation',()=>{it('validates cover art before previewing it',async()=>{const s=await readFile('src/pages/CreateChallenge.jsx','utf8');const h=s.indexOf('const handleCover');const v=s.indexOf('validateUpload(f, { accept: "image" })',h);const p=s.indexOf('URL.createObjectURL(f)',h);expect(v).toBeGreaterThan(h);expect(p).toBeGreaterThan(v);expect(s).toContain('e.target.value = ""');});});
