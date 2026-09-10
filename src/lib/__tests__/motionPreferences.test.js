import { describe, expect, it } from "vitest";
import {
  REDUCE_MOTION_STORAGE_KEY,
  readReduceMotionPreference,
  resolveReducedMotion,
  writeReduceMotionPreference,
} from "@/lib/motionPreferences";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("reduced motion preference", () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])("folds OS %s and user %s into %s", (osPreference, userPreference, expected) => {
    expect(resolveReducedMotion(osPreference, userPreference)).toBe(expected);
  });

  it("persists both enabled and disabled user choices", () => {
    const storage = createStorage();

    writeReduceMotionPreference(true, storage);
    expect(storage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe("1");
    expect(readReduceMotionPreference(storage)).toBe(true);

    writeReduceMotionPreference(false, storage);
    expect(storage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe("0");
    expect(readReduceMotionPreference(storage)).toBe(false);
  });
});
