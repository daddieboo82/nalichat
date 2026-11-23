// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai delivery errors are not AI replies', () => {
  it('keeps failed delivery as a visible local alert instead of a fabricated assistant message', async () => {
    const code = await source();
    expect(code).toContain('const [sendError, setSendError] = useState(null);');
    expect(code).toContain('setSendError(friendlyNaliError(err));');
    expect(code).toContain('<div role="alert"');
    expect(code).toContain('{sendError}');
    expect(code).not.toContain('content: friendlyNaliError(err)');
  });
  it('clears the error for new sends and account changes without erasing an unsent draft', async () => {
    const code = await source();
    expect(code).toContain('setSendError(null);');
    expect(code).toContain('if (!preserveDraft) setInput(current => current || text);');
    expect(code).toContain('Your message is still in the composer. Review it before trying again.');
  });
});
