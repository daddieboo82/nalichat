import { describe, expect, it } from "vitest";
import { clipLength, projectLength, splitClip, trimClip } from "./videoTimeline";
import { transformAt } from "./videoKeyframes";

const clip = { id: "a", assetId: "file", start: 2, in: 1, out: 9, sourceDuration: 12 };

describe("video timeline edits", () => {
  it("splits without losing or duplicating source footage", () => {
    const [first, second] = splitClip([clip], "a", 5);
    expect(first).toMatchObject({ start: 2, in: 1, out: 4 });
    expect(second).toMatchObject({ start: 5, in: 4, out: 9 });
    expect(clipLength(first) + clipLength(second)).toBe(clipLength(clip));
    expect(projectLength([first, second])).toBe(10);
  });
  it("rejects cuts outside the playable clip", () => {
    expect(splitClip([clip], "a", 1)).toEqual([clip]);
    expect(splitClip([clip], "a", 10)).toEqual([clip]);
  });
  it("keeps transform animation aligned when splitting and trimming", () => {
    const animated = { ...clip, keyframes: [{ time: 0, x: 0, y: 0, scale: 1 }, { time: 8, x: 80, y: 0, scale: 2 }] };
    const [first, second] = splitClip([animated], "a", 6);
    expect(transformAt(first, 5).x).toBe(30);
    expect(transformAt(second, 7).x).toBe(50);
    const trimmed = trimClip([animated], "a", "left", 4)[0];
    expect(transformAt(trimmed, 5).x).toBe(30);
  });
  it("trims the left edge while retaining media synchronization", () => {
    expect(trimClip([clip], "a", "left", 4)[0]).toMatchObject({ start: 4, in: 3, out: 9 });
    expect(trimClip([clip], "a", "right", 7)[0]).toMatchObject({ start: 2, in: 1, out: 7 });
  });
});
