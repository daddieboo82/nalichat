import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const cases = [
  ['base44/functions/deleteFolder/entry.ts', 'isBase44EntityId(folder.project_id)', 'Project.get(folder.project_id)'],
  ['base44/functions/mutateMilestone/entry.ts', 'isBase44EntityId(milestone.project_id)', 'Project.get(milestone.project_id)'],
  ['base44/functions/deleteTrackVersion/entry.ts', 'isBase44EntityId(version.project_id)', 'Project.get(version.project_id)'],
  ['base44/functions/deleteTrackVersion/entry.ts', 'isBase44EntityId(version.track_id)', 'acquireTrackLifecycleLock(entities, version.track_id)'],
  ['base44/functions/createFileShareLink/entry.ts', 'isBase44EntityId(filePreview.project_id)', 'Project.get(filePreview.project_id)'],
  ['base44/functions/castVote/entry.ts', 'isBase44EntityId(submissionPreview.challenge_id)', 'Challenge.get(submissionPreview.challenge_id)'],
];

describe('stored foreign entity reference validation', () => {
  for (const [path, validator, secondaryUse] of cases) {
    it(`${path} validates before secondary privileged use`, async () => {
      const source = await readFile(path, 'utf8');
      const check = source.indexOf(validator);
      const use = source.indexOf(secondaryUse);
      expect(check).toBeGreaterThan(-1);
      expect(use).toBeGreaterThan(check);
    });
  }
});
