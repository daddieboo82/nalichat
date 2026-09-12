import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Messages presence request", () => {
  it("requests viewer-authorized presence data for active indicators", async () => {
    const source = await readFile(
      new URL("../../src/pages/Messages.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "functions.invoke('listPublicUsers', { includePresence: true })",
    );
    expect(source).toContain('users={users}');
  });
});
