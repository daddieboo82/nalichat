import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("public user cache isolation", () => {
  it("scopes viewer-specific public-user queries by active account", async () => {
    const messages = await readText("src/pages/Messages.jsx");
    const contacts = await readText("src/components/messages/ContactsTab.jsx");
    const projectSettings = await readText("src/components/studio/ProjectSettingsDialog.jsx");

    expect(messages).toContain('queryKey: ["users", currentUser?.id]');
    expect(messages).toContain('enabled: !!currentUser?.id');

    expect(contacts).toContain('queryKey: ["users", currentUserId]');
    expect(contacts).toContain('enabled: !!currentUserId');

    expect(projectSettings).toContain('queryKey: ["users", currentUser?.id]');
    expect(projectSettings).toContain('enabled: open && !!currentUser?.id');
    expect(projectSettings).toContain('useAuth()');

    for (const source of [messages, contacts, projectSettings]) {
      expect(source).not.toContain('queryKey: ["users"],');
    }
  });
});
