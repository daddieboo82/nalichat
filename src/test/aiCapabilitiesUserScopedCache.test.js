// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('AI capabilities user-scoped cache', () => {
  it('isolates entitlement responses across account changes', async () => {
    const source = await readText('src/hooks/useAiCapabilities.js');

    expect(source).toContain('const { user } = useAuth();');
    expect(source).toContain('queryKey: ["ai-capabilities", user?.id || "anonymous"]');
    expect(source).not.toContain('queryKey: ["ai-capabilities"]');
  });
});
