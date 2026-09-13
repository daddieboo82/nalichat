import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message bubble private-DM feedback', () => {
  it('surfaces failures instead of swallowing private-conversation errors', async () => {
    const s = await readFile('src/components/messages/MessageBubble.jsx', 'utf8');
    expect(s).toContain('Failed to start private conversation:');
    expect(s).toContain("Couldn't open a private conversation. Please try again.");
    expect(s).not.toContain('await onStartDM(otherUser);\n              } catch {}');
  });
});
