import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

const cases = [
  ["base44/functions/leaveSquad/entry.ts", "readJsonBodyLimited(req, 8 * 1024)"],
  ["base44/functions/setChatTheme/entry.ts", "readJsonBodyLimited(req, 8 * 1024)"],
  ["base44/functions/updateUserPresence/entry.ts", "readJsonBodyLimited(req, 8 * 1024)"],
  ["base44/functions/mutateContact/entry.ts", "readJsonBodyLimited(req, 16 * 1024)"],
  ["base44/functions/reportContent/entry.ts", "readJsonBodyLimited(req, 16 * 1024)"],
  ["base44/functions/createProject/entry.ts", "readJsonBodyLimited(req, 64 * 1024)"],
];

describe("remaining request body bounds", () => {
  for (const [path, expectedRead] of cases) {
    it(`bounds and classifies body errors for ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain(expectedRead);
      expect(source).toContain("requestBodyErrorResponse(error)");
      expect(source).not.toContain("await req.json()");
    });
  }
});
