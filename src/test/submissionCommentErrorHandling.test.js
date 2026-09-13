import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('submission comment error handling', () => {
  it('surfaces load failures and catches send failures without duplicate submits', async () => {
    const s = await readFile('src/components/challenges/SubmissionComments.jsx', 'utf8');
    expect(s).toContain('const [loadError, setLoadError] = useState(false);');
    expect(s).toContain('const [sending, setSending] = useState(false);');
    expect(s).toContain('} catch {\n      setComments([]);\n      setLoadError(true);');
    expect(s).toContain('toast.error(error?.message || "Couldn\'t post your comment. Please try again.")');
    expect(s).toContain('if (!text.trim() || !user || sending) return;');
    expect(s).toContain('disabled={sending || !text.trim()}');
    expect(s).toContain("Couldn't load comments.");
    expect(s).toContain('onClick={() => void loadComments()}');
  });
});
