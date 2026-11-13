import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { getTrackClipRegions, splitTrackRegion } from "@/lib/studioClipRegions";

describe("Studio same-track split integration", () => {
  it("retains one track ID and preserves source mapping on both sides", () => {
    const track = { id: 7, startTime: 2, duration: 10, clipStart: 3, fullDuration: 20, waveform: [0.1, 0.4] };
    const split = splitTrackRegion(track, 6, side => `seven-${side}`);
    expect(split.id).toBe(7);
    expect(split.clipRegions).toHaveLength(2);
    const [left, right] = getTrackClipRegions(split);
    expect(left.timelineStart).toBe(2);
    expect(left.sourceStart).toBe(3);
    expect(left.sourceEnd).toBe(7);
    expect(right.timelineStart).toBe(6);
    expect(right.sourceStart).toBe(7);
    expect(right.sourceEnd).toBe(13);
    expect(split.duration).toBe(10);
  });

  it("preserves merged device backup entry points while integrating the split handler", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("handleSaveSessionToDevice");
    expect(studio).toContain("handleSessionImport");
    expect(studio).toContain("studioDeviceExportInFlightRef");
    expect(studio).toContain("studioRestoreInFlightRef");
    const start = studio.indexOf("if (activeTool === 'cut') {", studio.indexOf("{/* Audio Region (Clip) */}"));
    const end = studio.indexOf("if (activeTool === 'scrub')", start);
    const handler = studio.slice(start, end);
    expect(handler).toContain("splitTrackRegion(item, splitTime");
    expect(handler).toContain("setSelectedTrackIds([track.id])");
    expect(handler).not.toContain("rightClip");
    expect(handler).not.toContain("nextTrackId(");
    expect(handler).not.toContain("...prev.map");
  });
});
