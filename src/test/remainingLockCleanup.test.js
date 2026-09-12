// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const lockFiles = [
  ['base44/shared/trackLifecycleLock.ts', 'TrackLifecycleLock', 'track lifecycle'],
  ['base44/shared/callSummaryStartLock.ts', 'CallSummaryStartLock', 'call summary start'],
  ['base44/shared/artPostEngagementLock.ts', 'ArtPostEngagementLock', 'ArtPost engagement'],
  ['base44/shared/challengeLifecycleLock.ts', 'ChallengeLifecycleLock', 'challenge lifecycle'],
  ['base44/shared/sharedFileMutationLock.ts', 'SharedFileMutationLock', 'shared file mutation'],
  ['base44/shared/challengeSubmissionLock.ts', 'ChallengeSubmissionLock', 'challenge submission'],
  ['base44/shared/conversationMembershipLock.ts', 'ConversationMembershipLock', 'conversation membership'],
];

describe('remaining lock cleanup observability', () => {
  for (const [path, entity, label] of lockFiles) {
    it(`${path} reports cleanup failures instead of swallowing them`, async () => {
      const source = await readText(path);
      expect(source).toContain(`await entities.${entity}.delete(id);`);
      expect(source).not.toContain(`entities.${entity}.delete(id).catch(() => {})`);
      expect(source).toContain(`Failed to release ${label} lock:`);
      expect(source).toContain('return false;');
    });
  }
});
