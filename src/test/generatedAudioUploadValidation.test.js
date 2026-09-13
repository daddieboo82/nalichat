// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('generated audio upload validation',()=>{
 it('validates Studio bounce output before upload',async()=>{const s=await readFile('src/components/studio/BounceDialog.jsx','utf8');expect(s).toContain('validateUpload(file)');});
 it('validates collaborative recordings before upload',async()=>{const s=await readFile('src/components/messages/ChatSessionViewer.jsx','utf8');expect(s).toContain('validateUpload(file)');});
});
