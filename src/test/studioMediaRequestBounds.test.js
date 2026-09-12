import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Studio media request bounds", () => {
  it("bounds mastering and publish request bodies", async () => {
    const master = await readText("base44/functions/bounceAndMaster/entry.ts");
    const publish = await readText("base44/functions/publishStudioBounce/entry.ts");

    expect(master).toContain("readJsonBodyLimited(req, 16 * 1024)");
    expect(master).toContain("requestBodyErrorResponse(error)");
    expect(master).not.toContain("await req.json()");

    expect(publish).toContain("readJsonBodyLimited(req, 32 * 1024)");
    expect(publish).toContain("requestBodyErrorResponse(error)");
    expect(publish).not.toContain("await req.json()");
  });
});
