import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Supabase sync pagination', () => {
  it('syncs every entity page instead of only the newest 500 rows', async () => {
    const s = await readFile('base44/functions/syncToSupabase/entry.ts', 'utf8');
    expect(s).toContain('function getEntityService(base44, entityName)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('const records = await entity.list("-created_date", pageSize, skip)');
    expect(s).toContain('await supabaseUpsert(tableName, records)');
    expect(s).toContain('synced += records.length');
    expect(s).not.toContain('.list("-created_date", 500)');
  });
});
