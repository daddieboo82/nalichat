// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages page theme imports', () => {
  it('imports every subscription/theme symbol used by the page', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('import { useSubscription } from "@/hooks/useSubscription"');
    expect(source).toContain('CHAT_THEME_ENTITLEMENT');
    expect(source).toContain('getChatTheme');
    expect(source).toContain('resolveEffectiveChatThemeId');
    expect(source).toContain('from "@/lib/chatThemes"');
  });
});
