import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation preview pagination', () => {
  it('searches past pages of session signaling rows for the latest real message', async () => {
    const s = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    expect(s).toContain('async function findLatestNonSessionMessage');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain("page.find((candidate: any) => candidate.type !== 'session')");
    expect(s).toContain('const latest = await findLatestNonSessionMessage(entities, conversationId)');
    expect(s).toContain('const latest = await findLatestNonSessionMessage(\n        entities,\n        message.conversation_id,\n      )');
    expect(s).not.toContain("'-created_date',\n        50,");
  });
});
