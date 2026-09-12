import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Viral Moment AI quota metering', () => {
  it('reserves AI usage before transcription, LLM, or image dispatch', async () => {
    const source = await readFile('base44/functions/generate-viral-moment/entry.ts', 'utf8');
    const meter = source.indexOf('executeMeteredAiRequest({');
    expect(source).toContain("operation: type === 'meme' ? 'viral_moment_meme' : 'viral_moment_reel'");
    expect(source).toContain('requestKey: request_key');
    expect(meter).toBeGreaterThan(-1);
    expect(meter).toBeLessThan(source.indexOf('integrations.Core.TranscribeAudio'));
    expect(meter).toBeLessThan(source.indexOf('integrations.Core.InvokeLLM'));
    expect(meter).toBeLessThan(source.indexOf('integrations.Core.GenerateImage'));
    expect(source).toContain('if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);');
  });
});
