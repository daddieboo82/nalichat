// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final user-facing error states', () => {
  it('does not close onboarding until completion persists', async () => {
    const source = await readText('src/components/onboarding/WelcomeTour.jsx');
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(source).toContain('if (!await complete()) return;');
    expect(source).toContain("Couldn't save your tour progress. Please try again.");
  });

  it('distinguishes remix track loading failure from an empty library', async () => {
    const source = await readText('src/components/challenges/SubmitRemixModal.jsx');
    expect(source).toContain('const [tracksError, setTracksError] = useState(false);');
    expect(source).toContain("Couldn't load your published tracks. Close and reopen this dialog to retry.");
  });

  it('distinguishes admin auth failure from logged-out state', async () => {
    const source = await readText('src/pages/AdminDashboard.jsx');
    expect(source).toContain('const [authError, setAuthError] = useState(false);');
    expect(source).toContain("We couldn't verify your account. Refresh and try again.");
  });

  it('surfaces global message auth, directory, and send failures', async () => {
    const source = await readText('src/components/GlobalMessageDialog.jsx');
    expect(source).toContain('isError: usersError');
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(source).toContain("Couldn't verify your account. Close and reopen this dialog to retry.");
    expect(source).toContain("Couldn't load people. Please try again.");
    expect(source).toContain('toast.error(error?.message === "moderated"');
  });
});
