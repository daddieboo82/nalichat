import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { cutClipRegionSide, getClipSourceTimeAtTime, getTrackClipRegions, splitTrackRegion } from "@/lib/studioClipRegions";

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

  it("cuts one side without adding a mixer track or copying removed audio", () => {
    const track = { id: 7, startTime: 0, duration: 10, clipStart: 0, waveform: [0.1] };
    const removeLeft = cutClipRegionSide(track, "region-7-0", 3, { direction: "left" });
    const removeRight = cutClipRegionSide(track, "region-7-0", 7, { direction: "right" });
    expect(removeLeft.removed).toBe(true);
    expect(removeRight.removed).toBe(true);
    expect(removeLeft.id).toBe(track.id);
    expect(removeRight.id).toBe(track.id);
    expect(getTrackClipRegions(removeLeft)[0].sourceStart).toBe(3);
    expect(getTrackClipRegions(removeRight)[0].sourceEnd).toBe(7);
    expect(getTrackClipRegions(removeLeft)).toHaveLength(1);
    expect(getTrackClipRegions(removeRight)).toHaveLength(1);
  });

  it("maps transport times to source offsets and returns silence in a removed gap", () => {
    const track = {
      id: 12, startTime: 0, duration: 10, clipStart: 0,
      clipRegions: [
        { id: "a", timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: "b", timelineStart: 7, sourceStart: 7, sourceEnd: 10 },
      ],
    };
    expect(getClipSourceTimeAtTime(track, 1)).toBe(1);
    expect(getClipSourceTimeAtTime(track, 5)).toBeNull();
    expect(getClipSourceTimeAtTime(track, 8)).toBe(8);
  });

  it("uses region mapping for seek, playback start, and live transport sync", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("getClipSourceTimeAtTime(track, newTime)");
    expect(studio).toContain("getClipSourceTimeAtTime(track, currentTimeRef.current)");
    expect(studio).toContain("mixEngineRef.current?.syncClipRegion(track.id, track, region || null");
    expect(studio).toContain("if (sourceTime === null)");
    expect(studio).toContain("if (!audio.paused) audio.pause()");
  });

  it("renders edited waveforms in timeline coordinates with visible split boundaries", async () => {
    const [studio, waveform] = await Promise.all([
      readFile("src/pages/Studio.jsx", "utf8"),
      readFile("src/components/studio/TrackWaveformSVG.jsx", "utf8"),
    ]);
    expect(studio).toContain('<div className="absolute inset-0">\n                          <TrackWaveformSVG track={track} />');
    expect(studio).not.toContain('left: `${-(track.clipStart || 0) * 20 * zoom}px`');
    expect(waveform).toContain("const regions = getTrackClipRegions(track)");
    expect(waveform).toContain("region.timelineStart - trackStart");
    expect(waveform).toContain("regions.slice(1).map(region =>");
    expect(waveform).toContain('strokeDasharray="3 2"');
  });

  it("separates toolbar Split from directional Cut while keeping backup handlers", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    for (const name of ["handleSaveSessionToDevice", "handleSessionImport",
      "studioDeviceExportInFlightRef", "studioRestoreInFlightRef"]) {
      expect(studio).toContain(name);
    }
    const toolbarSplitStart = studio.indexOf("const splitSelectedTracks = () => {");
    const toolbarSplitEnd = studio.indexOf("const addTrack = () => {", toolbarSplitStart);
    const splitHandler = studio.slice(toolbarSplitStart, toolbarSplitEnd);
    expect(splitHandler).toContain("splitTrackRegion(result, point");
    expect(splitHandler).not.toContain("nextTrackId(");
    expect(splitHandler).not.toContain("updatedTracks = [...updatedTracks, ...additions]");
    const clipStart = studio.indexOf("{/* Audio Region (Clip) */}");
    const pointerDown = studio.indexOf("onPointerDown={(e) =>", clipStart);
    const start = studio.indexOf("if (activeTool === 'cut') {", pointerDown);
    const end = studio.indexOf("if (activeTool === 'scrub')", start);
    expect(start).toBeGreaterThan(pointerDown);
    const cutHandler = studio.slice(start, end);
    expect(cutHandler).toContain("const direction = cutTime < midpoint ? 'left' : 'right'");
    expect(cutHandler).toContain("cutClipRegionSide(track, region.id, cutTime");
    expect(cutHandler).not.toContain("rightClip");
    expect(cutHandler).not.toContain("nextTrackId(");
  });
});
