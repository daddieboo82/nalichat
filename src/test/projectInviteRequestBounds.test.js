import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("project invite request bounds", () => {
  it("bounds both invite creation and acceptance request bodies", async () => {
    const create = await readText("base44/functions/createProjectInvite/entry.ts");
    const accept = await readText("base44/functions/acceptProjectInvite/entry.ts");

    expect(create).toContain("readJsonBodyLimited(req, 64 * 1024)");
    expect(create).toContain("requestBodyErrorResponse(error)");

    expect(accept).toContain("readJsonBodyLimited(req, 8 * 1024)");
    expect(accept).toContain("requestBodyErrorResponse(error)");
    expect(accept).not.toContain("await req.json()");
  });
});
