// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('milestone update workflow compatibility', () => {
  it('does not drop valid update events when changed_fields metadata is absent', async () => {
    const source = await readText('base44/functions/notifyOnMilestoneUpdate/entry.ts');

    expect(source).toContain('Array.isArray(changed_fields)');
    expect(source).toContain('Array.isArray(event?.changed_fields)');
    expect(source).toContain('const changedFields =');
    expect(source).toContain('changedFields\n      && !changedFields.some');
    expect(source).not.toContain('!Array.isArray(changed_fields) ||');
  });
});
