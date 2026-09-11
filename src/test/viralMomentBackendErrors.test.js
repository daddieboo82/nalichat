// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('viral moment backend errors', () => {
  it('treats structured backend errors as failures instead of results', async () => {
    const source = await readText('src/components/messages/ViralMomentDialog.jsx');

    expect(source).toContain('if (response?.data?.error) throw new Error(response.data.error);');
    expect(source).toContain('setError(err?.message || "Nali couldn\'t create that moment. Try again!");');
    expect(source.indexOf('if (response?.data?.error)')).toBeLessThan(
      source.indexOf('setResult(response.data);'),
    );
  });
});
