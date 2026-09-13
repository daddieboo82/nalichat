// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('client/server upload limit parity',()=>{it('keeps image validation aligned with secureUploadFile',async()=>{const client=await readFile('src/lib/uploadValidation.js','utf8');const server=await readFile('base44/functions/secureUploadFile/entry.ts','utf8');expect(client).toContain("image: { maxBytes: 50 * MB");expect(server).toContain('image: 50 * MB');});});
