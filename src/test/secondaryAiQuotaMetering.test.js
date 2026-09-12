import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('secondary AI feature quota metering', () => {
  it('meters ViralSeed provider dispatches', async () => {
    const source = await readFile('base44/functions/generateViralConcepts/entry.ts', 'utf8');
    expect(source).toContain('executeMeteredAiRequest');
    expect(source).toContain("operation: 'viral_seed'");
    expect(source).toContain('requestKey: body?.request_key');
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(source.indexOf('integrations.Core.InvokeLLM'));
    expect(source).toContain('if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);');
  });

  it('meters artist bio provider dispatches', async () => {
    const source = await readFile('base44/functions/generateArtistBio/entry.ts', 'utf8');
    expect(source).toContain('executeMeteredAiRequest');
    expect(source).toContain("operation: 'artist_bio'");
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(source.indexOf('integrations.Core.InvokeLLM'));
    expect(source).toContain('if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);');
  });
});
