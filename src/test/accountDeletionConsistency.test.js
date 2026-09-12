// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('account deletion shared-state cleanup', () => {
  it('does not swallow vote-count decrement failures before deleting votes', async () => {
    const source = await readText('base44/functions/deleteMyAccount/entry.ts');
    expect(source).toContain('await entities.ChallengeSubmission.updateMany(');
    expect(source).toContain('await entities.ChallengeVote.delete(vote.id);');
    expect(source).not.toContain('} catch {}\n        await entities.ChallengeVote.delete(vote.id);');
  });

  it('does not swallow squad partner membership cleanup failures', async () => {
    const source = await readText('base44/functions/deleteMyAccount/entry.ts');
    expect(source).toContain('id: squad.member_b_id, squad_membership_id: squad.id');
    expect(source).toContain('id: squad.member_a_id, squad_membership_id: squad.id');
    expect(source).not.toContain(').catch(() => {});\n        }');
  });
});
