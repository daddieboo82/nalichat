import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("paid AI request body bounds", () => {
  it("bounds speech and assistant request bodies before provider work", async () => {
    const speech = await readText("base44/functions/generate-speech/entry.ts");
    const agent = await readText("base44/functions/sendAgentMessage/entry.ts");

    expect(speech).toContain("readJsonBodyLimited(req, 16 * 1024)");
    expect(speech).toContain("requestBodyErrorResponse(error)");
    expect(speech).not.toContain("await req.json()");

    expect(agent).toContain("readJsonBodyLimited(req, 24 * 1024)");
    expect(agent).toContain("requestBodyErrorResponse(error)");
    expect(agent).not.toContain("await req.json()");
  });
});
