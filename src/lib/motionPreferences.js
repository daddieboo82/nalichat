export const REDUCE_MOTION_STORAGE_KEY = "nali_reduce_motion";
export const REDUCE_MOTION_CHANGE_EVENT = "nali:reduce-motion-change";

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readReduceMotionPreference(storage = browserStorage()) {
  if (!storage) return false;
  try {
    return storage.getItem(REDUCE_MOTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeReduceMotionPreference(enabled, storage = browserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(REDUCE_MOTION_STORAGE_KEY, enabled ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

export function resolveReducedMotion(osReducedMotion, userReducedMotion) {
  return Boolean(osReducedMotion || userReducedMotion);
}
