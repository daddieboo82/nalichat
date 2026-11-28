// Narrow compatibility patch for the installed SDK's initial foreground timer.
// Apply at build time, never mutate the installed dependency or emit extra events.
export function patchBase44AnalyticsTimer(source) {
  const start = '        isStarted = true;\n        // start the flusing process ///';
  const stop = '        isStarted = false;\n        stopAnalyticsProcessor();';
  if (!source.includes(start) || !source.includes(stop)) return null;
  return source.replace(start, '        isStarted = true;\n        if (typeof document !== "undefined" && document.visibilityState === "visible") setSessionDurationTimerStart();\n        // start the flusing process ///').replace(stop, '        isStarted = false;\n        analyticsSharedState.sessionStartTime = null;\n        stopAnalyticsProcessor();');
}
export function base44AnalyticsTimerPatch() {
  return {
    name: 'nali-base44-analytics-timer',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\\\', '/').endsWith('/@base44/sdk/dist/modules/analytics.js')) return null;
      const patched = patchBase44AnalyticsTimer(code);
      if (!patched) { this.warn('Base44 analytics SDK changed; review timer compatibility patch.'); return null; }
      return { code: patched, map: null };
    },
  };
}
