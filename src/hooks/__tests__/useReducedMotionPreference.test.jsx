// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { REDUCE_MOTION_STORAGE_KEY } from "@/lib/motionPreferences";

function installMatchMedia(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    addEventListener: vi.fn((type, listener) => {
      if (type === "change") listeners.add(listener);
    }),
    removeEventListener: vi.fn((type, listener) => {
      if (type === "change") listeners.delete(listener);
    }),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
  return {
    setMatches(nextMatches) {
      matches = nextMatches;
      listeners.forEach(listener => listener({ matches }));
    },
  };
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("reduce-motion");
  vi.unstubAllGlobals();
});

describe("useReducedMotionPreference", () => {
  it("updates when the OS preference changes at runtime", () => {
    const mediaQuery = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotionPreference());

    expect(result.current.reduceMotion).toBe(false);
    act(() => mediaQuery.setMatches(true));
    expect(result.current.osReducedMotion).toBe(true);
    expect(result.current.reduceMotion).toBe(true);
  });

  it("persists the in-app preference and safely combines it with the OS", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotionPreference());

    act(() => result.current.setUserReducedMotion(true));
    expect(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe("1");
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);

    act(() => result.current.setUserReducedMotion(false));
    expect(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe("0");
    expect(result.current.userReducedMotion).toBe(false);
    expect(result.current.reduceMotion).toBe(true);
  });
});
