// localStorage-backed translation cache. Maps original text → translated text
// for a given target language, so repeated visits and re-renders skip the LLM.

const CACHE_PREFIX = "nali:i18n:";

function cacheKey(lang) {
  return CACHE_PREFIX + lang;
}

export function loadCache(lang) {
  try {
    const raw = localStorage.getItem(cacheKey(lang));
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return new Map();
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function saveCache(lang, map) {
  try {
    const obj = Object.fromEntries(map);
    localStorage.setItem(cacheKey(lang), JSON.stringify(obj));
  } catch {
    // Quota exceeded or storage disabled — translations still work in-memory for this session.
  }
}