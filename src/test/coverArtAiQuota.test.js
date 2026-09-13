import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('AI cover art quota metering', () => {
  it('reserves canonical AI usage before any paid provider dispatch', async () => {
    const source = await readFile('base44/functions/generate-cover-art/entry.ts', 'utf8');

    expect(source).toContain('executeMeteredAiRequest');
    expect(source).toContain("operation: 'cover_art'");
    expect(source).toContain('requestKey,');
    expect(source).toContain("const requestKey = explicitRequestKey || `cover-art:${user.id}:${post_id}:${fallbackBucket}`");
    expect(source).not.toContain('requestKey: request_key');
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(
      source.indexOf('integrations.Core.TranscribeAudio'),
    );
    expect(source).toContain('if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);');
  });
});
