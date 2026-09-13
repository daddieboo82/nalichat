import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('contact DM failure feedback', () => {
  it('surfaces failures when a contact DM cannot be opened', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('Failed to start DM from Contacts:');
    expect(s).toContain('toast.error("Couldn\'t start this conversation. Please try again.");');
    expect(s).not.toContain('await startDM(u);\n                        setSidebarTab("chats");\n                      } catch {}');
  });
});
