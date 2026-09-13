import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('content report response validation', () => {
  it('does not show report success for backend error or unconfirmed responses', async () => {
    const s = await readFile('src/components/ReportContentDialog.jsx', 'utf8');
    expect(s).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(s).toContain('Report submission was not confirmed');
    expect(s).toContain('Report submitted. Thank you for helping keep NaliChat safe.');
  });
});
