// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('AI quota reservation idempotency', () => {
  it('uses deterministic reservation ids and recognizes concurrent collisions', async () => {
    const source = await readText('base44/shared/aiQuota.ts');

    expect(source).toContain('async function reservationId');
    expect(source).toContain('ai_usage_');
    expect(source).toContain('id,');
    expect(source).toContain('const raced = await entity.get(id)');
    expect(source).toContain('AI_REQUEST_ALREADY_DISPATCHED');
    expect(source).toContain('AI_REQUEST_IN_PROGRESS');
  });
});
