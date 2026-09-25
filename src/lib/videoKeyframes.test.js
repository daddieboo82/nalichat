import { describe, expect, it } from "vitest";
import { removeTransformKeyframe, setTransformKeyframe, transformAt } from "./videoKeyframes";

describe("clip transform keyframes", () => {
  const clip = { start: 5, in: 0, out: 10, keyframes: [] };
  it("interpolates position and scale between points", () => {
    const first = setTransformKeyframe(clip, 5, { x: -20, scale: 1 });
    const second = setTransformKeyframe(first, 9, { x: 20, scale: 2 });
    expect(transformAt(second, 7)).toEqual({ x: 0, y: 0, scale: 1.5 });
  });
  it("replaces a point and removes only the selected point", () => {
    const first = setTransformKeyframe(clip, 5, { x: 10 });
    const second = setTransformKeyframe(first, 5, { x: 25 });
    expect(second.keyframes).toHaveLength(1);
    expect(transformAt(second, 6).x).toBe(25);
    expect(removeTransformKeyframe(second, 5).keyframes).toHaveLength(0);
  });
});
