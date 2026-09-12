import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

const boundedEndpoints = [
  ["base44/functions/castVote/entry.ts", "8 * 1024"],
  ["base44/functions/joinSquad/entry.ts", "8 * 1024"],
  ["base44/functions/toggleLike/entry.ts", "8 * 1024"],
  ["base44/functions/createArtPost/entry.ts", "64 * 1024"],
  ["base44/functions/mutateArtPost/entry.ts", "32 * 1024"],
  ["base44/functions/deleteArtPost/entry.ts", "8 * 1024"],
  ["base44/functions/searchMessages/entry.ts", "16 * 1024"],
  ["base44/functions/getSquadInvite/entry.ts", "8 * 1024"],
  ["base44/functions/updateMyProfile/entry.ts", "32 * 1024"],
  ["base44/functions/recordArtPostView/entry.ts", "8 * 1024"],
  ["base44/functions/recordArtPostPlay/entry.ts", "8 * 1024"],
  ["base44/functions/updateTypingStatus/entry.ts", "8 * 1024"],
  ["base44/functions/completeOnboarding/entry.ts", "16 * 1024"],
  ["base44/functions/recordSquadActivity/entry.ts", "8 * 1024"],
  ["base44/functions/revokeProjectInvites/entry.ts", "8 * 1024"],
  ["base44/functions/cancelFollowUpReminder/entry.ts", "8 * 1024"],
  ["base44/functions/createFollowUpReminder/entry.ts", "16 * 1024"],
  ["base44/functions/listPublicAchievements/entry.ts", "8 * 1024"],
  ["base44/functions/deleteMyAccount/entry.ts", "8 * 1024"],
  ["base44/functions/claimPublishedPostReward/entry.ts", "8 * 1024"],
  ["base44/functions/registerPushSubscription/entry.ts", "16 * 1024"],
  ["base44/functions/rescheduleFollowUpReminder/entry.ts", "8 * 1024"],
  ["base44/functions/unregisterPushSubscription/entry.ts", "16 * 1024"],
  ["base44/functions/listPublicUsers/entry.ts", "8 * 1024"],
];

describe("remaining JSON endpoints use bounded request readers", () => {
  for (const [path, limit] of boundedEndpoints) {
    it(`bounds ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain(`readJsonBodyLimited(req, ${limit})`);
      expect(source).toContain("requestBodyErrorResponse(error)");
      expect(source).not.toContain("await req.json()");
    });
  }
});
