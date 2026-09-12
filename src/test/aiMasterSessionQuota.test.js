import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('AI mastering quota metering', () => {
  it('reserves canonical AI usage before provider dispatch', async () => {
    const source = await readFile('base44/functions/aiMasterSession/entry.ts', 'utf8');
    expect(source).toContain('executeMeteredAiRequest');
    expect(source).toContain("operation: 'ai_master_session'");
    expect(source).toContain('requestKey: request_key');
    expect(source.indexOf('executeMeteredAiRequest({')).toBeLessThan(source.indexOf('integrations.Core.InvokeLLM'));
    expect(source).toContain('if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);');
  });
});
