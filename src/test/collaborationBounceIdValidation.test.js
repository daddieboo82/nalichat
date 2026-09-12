import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('collaboration/bounce entity id validation', () => {
  it('validates collaboration project session ids before lookup', async () => { const s=await readFile('base44/functions/manageCollaboration/entry.ts','utf8'); expect(s.indexOf('isBase44EntityId(session_id.trim())')).toBeLessThan(s.indexOf('Project.get(session_id)')); });
  it('validates optional bounce project ids before lookup', async () => { const s=await readFile('base44/functions/publishStudioBounce/entry.ts','utf8'); expect(s.indexOf('isBase44EntityId(projectId)')).toBeLessThan(s.indexOf('Project.get(projectId)')); });
});
