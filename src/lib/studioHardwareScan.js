// Only the latest hardware scan may publish its results.
export function isCurrentStudioHardwareScan(scan, latest, mounted) {
  return mounted && scan === latest;
}
