import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("collaboration mutation request bounds", () => {
  it("bounds collaboration, presence, track, and playlist mutation bodies", async () => {
    const expectations = [
      ["base44/functions/manageCollaboration/entry.ts", "readJsonBodyLimited(req, 64 * 1024)"],
      ["base44/functions/createCollaborativeTrack/entry.ts", "readJsonBodyLimited(req, 32 * 1024)"],
      ["base44/functions/updateStudioPresence/entry.ts", "readJsonBodyLimited(req, 16 * 1024)"],
      ["base44/functions/createPlaylist/entry.ts", "readJsonBodyLimited(req, 32 * 1024)"],
      ["base44/functions/mutatePlaylist/entry.ts", "readJsonBodyLimited(req, 32 * 1024)"],
    ];

    for (const [path, expected] of expectations) {
      const source = await readText(path);
      expect(source).toContain(expected);
      expect(source).toContain("requestBodyErrorResponse(error)");
      expect(source).not.toContain("await req.json()");
    }
  });
});
