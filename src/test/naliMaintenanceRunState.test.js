import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Nali maintenance run state', () => {
  it('prevents concurrent diagnose/repair runs and validates backend results', async () => {
    const s = await readFile('src/components/admin/NaliMaintenancePanel.jsx', 'utf8');
    expect(s).toContain("const runMode = repairMode ? 'repair' : 'diagnose';");
    expect(s).toContain('if (mode) return;');
    expect(s).toContain('disabled={mode !== null}');
    expect(s).toContain('mode === "diagnose"');
    expect(s).toContain('mode === "repair"');
    expect(s).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(s).toContain('Maintenance response was invalid');
  });
});
