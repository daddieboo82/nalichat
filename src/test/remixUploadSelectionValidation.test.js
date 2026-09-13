// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('remix upload selection validation',()=>{it('rejects invalid remix files when selected',async()=>{const s=await readFile('src/components/challenges/SubmitRemixModal.jsx','utf8');expect(s).toContain('validateUpload(selected)');expect(s).toContain('e.target.value = ""');});});
