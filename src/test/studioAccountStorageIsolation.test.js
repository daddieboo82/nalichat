import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Studio account-switch storage isolation", () => {
  it("scopes local Studio state to the authenticated user and clears in-memory state on account change", async () => {
    const source = await readFile(
      new URL("../../src/pages/Studio.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('const studioStorageOwner = user?.id || null;');
    expect(source).toContain('nalistudio_master_fx:${studioStorageOwner}');
    expect(source).toContain('nalistudio_project_autosave:${studioStorageOwner}');
    expect(source).toContain('if (!masterFxStorageKey) return null;');
    expect(source).toContain('if (!autosaveStorageKey) return;');
    expect(source).toContain('setTracks([]);');
    expect(source).toContain('setMasterFx({});');
    expect(source).toContain('setHasAutosave(false);');
    expect(source).toContain('}, [studioStorageOwner]);');

    expect(source).not.toContain("localStorage.getItem('nalistudio_master_fx')");
    expect(source).not.toContain("localStorage.getItem('nalistudio_project_autosave')");
    expect(source).not.toContain("localStorage.setItem('nalistudio_master_fx'");
    expect(source).not.toContain("localStorage.setItem('nalistudio_project_autosave'");
  });
});
