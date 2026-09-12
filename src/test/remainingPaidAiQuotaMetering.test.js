import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('remaining paid AI quota metering', () => {
  it('meters standalone voice transcription', async () => {
    const source = await readFile('base44/functions/transcribeMessageAudio/entry.ts', 'utf8');
    expect(source).toContain("operation: 'voice_transcription'");
    expect(source).toContain('requestKey: request_key');
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(source.indexOf('integrations.Core.TranscribeAudio'));
  });

  it('meters AI speech generation', async () => {
    const source = await readFile('base44/functions/generate-speech/entry.ts', 'utf8');
    expect(source).toContain("operation: 'ai_speech'");
    expect(source).toContain('requestKey: request_key');
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(source.indexOf('integrations.Core.GenerateSpeech'));
    expect(source).toContain("? { ...result, quota }");
  });

  it('meters track tag suggestions against the entitled user', async () => {
    const source = await readFile('base44/functions/suggestTrackTags/entry.ts', 'utf8');
    expect(source).toContain('const quotaUser = { id: entitlementUserId };');
    expect(source).toContain("operation: 'track_tag_suggestion'");
    expect(source).toContain('`track-tags:${trackId}`');
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(source.indexOf('integrations.Core.InvokeLLM'));
  });

  for (const path of [
    'base44/functions/transcribeMessageAudio/entry.ts',
    'base44/functions/generate-speech/entry.ts',
    'base44/functions/suggestTrackTags/entry.ts',
  ]) {
    it(`maps quota errors for ${path}`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain('if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);');
    });
  }
});
