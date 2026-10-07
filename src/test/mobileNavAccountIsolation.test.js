import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("mobile navigation simple design", () => {
  it("uses direct path-based navigation without per-account tab stacks", async () => {
    const source = await readFile(
      new URL("../../src/components/navigation/MobileNav.jsx", import.meta.url),
      "utf8",
    );

    // The simplified nav no longer maintains per-user tab stacks or session storage.
    // Navigation is direct: tap a tab, go to that feature.
    expect(source).toContain("PRIMARY_TABS");
    expect(source).toContain("getActiveTab");
    expect(source).not.toContain("mobile_nav_stacks");
    expect(source).not.toContain("loadStacks");
    expect(source).not.toContain("saveStacks");
  });
});