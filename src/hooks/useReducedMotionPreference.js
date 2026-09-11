import { useCallback, useEffect, useState } from "react";
import {
  REDUCE_MOTION_CHANGE_EVENT,
  REDUCE_MOTION_STORAGE_KEY,
  readReduceMotionPreference,
  resolveReducedMotion,
  writeReduceMotionPreference,
} from "@/lib/motionPreferences";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readOsReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotionPreference() {
  const [osReducedMotion, setOsReducedMotion] = useState(readOsReducedMotion);
  const [userReducedMotion, setUserReducedMotionState] = useState(
    readReduceMotionPreference
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const syncOsPreference = (event) => setOsReducedMotion(event.matches);
    setOsReducedMotion(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncOsPreference);
      return () => mediaQuery.removeEventListener("change", syncOsPreference);
    }
    mediaQuery.addListener(syncOsPreference);
    return () => mediaQuery.removeListener(syncOsPreference);
  }, []);

  useEffect(() => {
    const syncPreference = (event) => {
      if (event.type === "storage" && event.key !== REDUCE_MOTION_STORAGE_KEY) return;
      setUserReducedMotionState(readReduceMotionPreference());
    };
    window.addEventListener("storage", syncPreference);
    window.addEventListener(REDUCE_MOTION_CHANGE_EVENT, syncPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener(REDUCE_MOTION_CHANGE_EVENT, syncPreference);
    };
  }, []);

  const setUserReducedMotion = useCallback((enabled) => {
    if (!writeReduceMotionPreference(enabled)) {
      console.error("Unable to persist the reduced-motion preference.");
      return;
    }
    setUserReducedMotionState(enabled);
    window.dispatchEvent(new Event(REDUCE_MOTION_CHANGE_EVENT));
  }, []);

  const reduceMotion = resolveReducedMotion(osReducedMotion, userReducedMotion);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", userReducedMotion);
  }, [userReducedMotion]);

  return {
    osReducedMotion: Boolean(osReducedMotion),
    userReducedMotion,
    reduceMotion,
    setUserReducedMotion,
  };
}
