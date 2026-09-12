import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("mobile navigation account isolation", () => {
  it("scopes tab stacks to the authenticated account", async () => {
    const source = await readFile(
      new URL("../../src/components/navigation/MobileNav.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('const { user } = useAuth();');
    expect(source).toContain('mobile_nav_stacks:${userId || "anonymous"}');
    expect(source).toContain('loadStacks(storageKey, user?.id)');
    expect(source).toContain('saveStacks(storageKey, next)');
    expect(source).toContain('if (!userId)');
    expect(source).toContain('sessionStorage.removeItem(LEGACY_STORAGE_KEY)');
  });
});
