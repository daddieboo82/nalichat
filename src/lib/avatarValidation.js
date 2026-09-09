/**
 * Validates that a URL looks like an actual image URL, not a page route.
 * Prevents users from saving non-image URLs (e.g. "https://nalichat.org/settings")
 * as their avatar, which would render a broken image.
 */
export function isValidAvatarUrl(url) {
  if (!url) return true; // empty is valid — no avatar set
  if (typeof url !== "string") return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;

  // Accept URLs with common image extensions
  const imageExtRegex = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|#|$)/i;
  if (imageExtRegex.test(url)) return true;

  // Accept URLs from known storage / CDN domains (base44 uploads, cloud storage)
  const cdnPatterns = ["base44", "googleapis", "amazonaws", "cloudinary", "imgur", "githubusercontent"];
  if (cdnPatterns.some((p) => url.includes(p))) return true;

  // Anything else (page routes like /settings, /profile) is rejected
  return false;
}

/**
 * Returns a cleaned avatar_url: the original if valid, or empty string if invalid.
 */
export function sanitizeAvatarUrl(url) {
  return isValidAvatarUrl(url) ? url : "";
}