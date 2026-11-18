// NaliChat device-only recording storage guidance. Browser quota estimates
// are advisory, sometimes rounded, and cannot guarantee a future IndexedDB
// write; actual transaction success is still required.
export const STUDIO_STORAGE_RESERVE_BYTES = 16 * 1024 * 1024;
export const STUDIO_RECOVERY_WARNING_BYTES = 40 * 1024 * 1024;

export async function studioRecoveryStorageHealth({
  storage = globalThis.navigator?.storage,
  expectedAdditionalBytes = 0,
} = {}) {
  if (!storage || typeof storage.estimate !== 'function') {
    return {supported:false,level:'unknown',reason:'Device storage estimates are unavailable.'};
  }
  try {
    const estimate = await storage.estimate();
    const quota = Number(estimate.quota), usage = Number(estimate.usage);
    if (!Number.isSafeInteger(quota) || !Number.isSafeInteger(usage) ||
        quota <= 0 || usage < 0 || usage > quota ||
        !Number.isFinite(expectedAdditionalBytes) || expectedAdditionalBytes < 0) {
      return {supported:false,level:'unknown',reason:'Device storage estimate was incomplete.'};
    }
    const freeBytes = quota - usage;
    const remaining = freeBytes - expectedAdditionalBytes;
    const level = remaining <= STUDIO_STORAGE_RESERVE_BYTES ? 'critical'
      : remaining <= STUDIO_RECOVERY_WARNING_BYTES ? 'warning' : 'ok';
    return {supported:true,level,usageBytes:usage,quotaBytes:quota,freeBytes,
      detail: level === 'critical'
        ? 'Your phone reports very little browser storage. Save your Studio session to the cloud and free device space.'
        : level === 'warning'
          ? 'Device storage is getting low. Save for PC to protect your takes.'
          : 'Device storage currently has room for recording recovery.'};
  } catch {
    return {supported:false,level:'unknown',reason:'Browser storage estimate was blocked.'};
  }
}

export function isStudioStorageQuotaError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  return name === 'QuotaExceededError' || /quota exceeded|storage quota|disk full|no space left/i.test(message);
}
