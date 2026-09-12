import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const cases = [
  ['base44/functions/notifyOnFileUpload/entry.ts', 'isBase44EntityId(file.project_id)', 'Project.get(file.project_id)'],
  ['base44/functions/notifyOnTrackVersion/entry.ts', 'isBase44EntityId(version.project_id)', 'Project.get(version.project_id)'],
  ['base44/functions/notifyOnMilestoneUpdate/entry.ts', 'isBase44EntityId(milestone.project_id)', 'Project.get(milestone.project_id)'],
  ['base44/functions/notifyOnMessage/entry.ts', 'isBase44EntityId(message.conversation_id)', 'Conversation.get(message.conversation_id)'],
  ['base44/functions/notifyOnTrackComment/entry.ts', 'isBase44EntityId(comment.track_id)', 'ArtPost.get(comment.track_id)'],
];

describe('workflow parent reference validation', () => {
  for (const [path, validator, lookup] of cases) {
    it(path, async () => {
      const s = await readFile(path, 'utf8');
      expect(s.indexOf(validator)).toBeGreaterThan(-1);
      expect(s.indexOf(validator)).toBeLessThan(s.indexOf(lookup));
    });
  }
});
