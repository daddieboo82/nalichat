import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('tag suggestion project reference stability', () => {
  it('validates the preview project before AI context lookup', async () => {
    const s=await readFile('base44/functions/suggestTrackTags/entry.ts','utf8');
    const validate=s.indexOf('!isBase44EntityId(previewProjectId)');
    const lookup=s.indexOf('Project.get(previewProjectId)');
    expect(validate).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(validate);
  });
  it('rejects project changes after lifecycle lock acquisition', async () => {
    const s=await readFile('base44/functions/suggestTrackTags/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireTrackLifecycleLock');
    const check=s.indexOf('Track project changed. Please retry.', lock);
    const projectWrite=s.indexOf('Project.get(previewProjectId)', lock);
    expect(check).toBeGreaterThan(lock);
    expect(projectWrite).toBeGreaterThan(check);
  });
});
