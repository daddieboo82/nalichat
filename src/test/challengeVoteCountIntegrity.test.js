import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge vote count integrity', () => {
  it('requires the vote counter update to modify exactly one submission', async () => {
    const s = await readFile('base44/functions/castVote/entry.ts', 'utf8');
    const create = s.indexOf('await entities.ChallengeVote.create({');
    const count = s.indexOf('const countUpdate = await entities.ChallengeSubmission.updateMany');
    const verify = s.indexOf('Number(countUpdate?.updated || 0) !== 1');
    const rollback = s.indexOf('await entities.ChallengeVote.delete(id)');

    expect(create).toBeGreaterThan(-1);
    expect(count).toBeGreaterThan(create);
    expect(verify).toBeGreaterThan(count);
    expect(rollback).toBeGreaterThan(verify);
  });
});
