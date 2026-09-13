import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio Editor mastering display', () => {
  it('renders the current numeric aiMasterSession response fields', async () => {
    const s = await readFile('src/pages/StudioEditor.jsx', 'utf8');
    expect(s).toContain('masterAnalysis.low_shelf.gain_db');
    expect(s).toContain('masterAnalysis.compressor.threshold_db');
    expect(s).toContain('masterAnalysis.limiter_ceiling_db');
    expect(s).toContain('masterAnalysis.notes || "No additional notes."');
    expect(s).not.toContain('masterAnalysis.eq_recommendations');
    expect(s).not.toContain('masterAnalysis.recommendations');
  });
});
