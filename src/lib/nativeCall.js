/**
 * Native call routing with in-app fallback.
 *
 * Detects whether the device supports native audio/video calling and routes
 * calls through the device's built-in calling apps (tel: / facetime:) when
 * available. When native calling isn't supported, the caller falls back to
 * the custom in-app audio/video messaging engine.
 */

// Cache capability detection so we only probe once per session.
let capabilityCache = null;

/**
 * Detects native calling capability for the current device/browser.
 * Returns { audio: boolean, video: boolean }.
 */
export function detectNativeCallCapability() {
  if (capabilityCache) return capabilityCache;

  const ua = (typeof navigator !== "undefined" ? navigator.userAgent || "" : "").toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && typeof document !== "undefined" && "ontouchend" in document);
  const isAndroid = /android/.test(ua);
  const isMobile = isIOS || isAndroid;
  const isMacSafari = /macintosh/.test(ua) && /safari/.test(ua) && !/chrome/.test(ua);

  // tel: works on iOS, Android, and macOS Safari — opens the native phone/FaceTime dialog.
  // On desktop browsers (Chrome/Firefox/Edge) tel: may prompt to open an app handler but
  // usually has no real phone app, so we treat it as unsupported there.
  const audioCapable = isMobile || isMacSafari;

  // FaceTime is iOS/macOS only. Android has no native video-calling URI scheme that reliably
  // opens a built-in app, so video calls on Android fall back to the in-app engine.
  const videoCapable = isIOS || isMacSafari;

  capabilityCache = { audio: audioCapable, video: videoCapable };
  return capabilityCache;
}

/**
 * Routes a call through the device's native calling app when supported.
 * Returns true if a native app was launched, false if the caller should
 * fall back to the in-app engine.
 *
 * @param {object} opts
 * @param {"audio"|"video"} opts.type  Call type.
 * @param {string} opts.phoneNumber   E.164 phone number for audio calls (tel:).
 * @param {string} [opts.email]       Apple ID email for FaceTime video calls.
 */
export function routeNativeCall({ type, phoneNumber, email }) {
  const cap = detectNativeCallCapability();

  if (type === "audio" && cap.audio && phoneNumber) {
    // Normalize: ensure it starts with + for international dialing.
    const normalized = phoneNumber.trim().startsWith("+") ? phoneNumber.trim() : `+${phoneNumber.trim()}`;
    window.location.href = `tel:${normalized.replace(/[\s()-]/g, "")}`;
    return true;
  }

  if (type === "video" && cap.video) {
    // FaceTime on iOS/macOS supports both phone and email.
    const target = email || phoneNumber;
    if (target) {
      window.location.href = `facetime:${target.trim().replace(/[\s()-]/g, "")}`;
      return true;
    }
  }

  return false;
}