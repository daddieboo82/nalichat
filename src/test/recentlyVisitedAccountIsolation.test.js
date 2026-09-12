import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("recently visited account isolation", () => {
  it("scopes route history by authenticated user", async () => {
    const source = await readFile(
      new URL("../../src/components/navigation/RecentlyVisited.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('const { user } = useAuth();');
    expect(source).toContain('nali_recent_pages:${userId || "anonymous"}');
    expect(source).toContain('sessionStorage.getItem(storageKey)');
    expect(source).toContain('sessionStorage.setItem(storageKey, JSON.stringify(updated))');
    expect(source).toContain('if (!raw && !user?.id)');
    expect(source).toContain('sessionStorage.removeItem(LEGACY_STORAGE_KEY)');
  });
});
