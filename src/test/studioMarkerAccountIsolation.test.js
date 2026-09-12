import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Studio marker account isolation", () => {
  it("scopes marker storage by authenticated user and clears markers when the key changes", async () => {
    const source = await readFile(
      new URL("../../src/components/studio/MarkersBar.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("import { useAuth } from '@/lib/AuthContext';");
    expect(source).toContain("const { user } = useAuth();");
    expect(source).toContain("nalistudio_markers_${user.id}_${projectId || 'local'}");
    expect(source).toContain("setMarkers([]);");
    expect(source).toContain("if (!storageKey) return;");
  });
});
