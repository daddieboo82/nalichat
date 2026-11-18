// Informational checks only; true means necessary browser APIs exist,
// not that large ONNX weights can fit in memory or that inference will succeed.
export function checkLocalRvcReadiness({
  workerAvailable = typeof Worker !== 'undefined',
  wasmAvailable = typeof WebAssembly !== 'undefined',
  memoryGB = globalThis.navigator?.deviceMemory,
} = {}) {
  if (!workerAvailable) return {
    supported: false, reason: 'This browser does not support the workers needed for local AI voice conversion.',
  };
  if (!wasmAvailable) return {
    supported: false, reason: 'WebAssembly is unavailable, so local RVC cannot run here.',
  };
  if (Number.isFinite(memoryGB) && memoryGB < 4) {
    return {
      supported: true,
      caution: true,
      reason: 'Local RVC uses WebAssembly (CPU). This device reports limited memory; large voice models may fail. Use a desktop browser with more memory for best results.',
    };
  }
  return {
    supported: true,
    caution: false,
    reason: 'Browser workers and WebAssembly are available. This does not guarantee your chosen models will run. No hosted inference service is needed.',
  };
}
