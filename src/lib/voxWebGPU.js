// Free on-device WebGPU capability check.
// This module does not download a model, contact an inference provider, or spend credits.
// Adapter/device availability is a prerequisite, not proof that a voice model will run.
export async function checkLocalWebGPU({ navigatorObject = globalThis.navigator, secure = globalThis.isSecureContext } = {}) {
  if (secure === false) return { ready: false, reason: 'WebGPU requires an HTTPS secure connection.' };
  if (!navigatorObject?.gpu?.requestAdapter) {
    return { ready: false, reason: 'WebGPU is not enabled in this browser or device.' };
  }
  let adapter;
  try {
    adapter = await navigatorObject.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { ready: false, reason: 'No compatible WebGPU adapter is available.' };
    // Request a real device to rule out adapters that cannot initialize.
    const device = await adapter.requestDevice();
    try {
      if (!device) return { ready: false, reason: 'A WebGPU device could not be initialized.' };
      const maxBufferSize = Number(device.limits?.maxBufferSize || 0);
      if (device.lost?.then) device.lost.then(() => {}).catch(() => {});
      return { ready: true, maxBufferSize, reason: 'WebGPU is available for free on-device processing. No AI model is loaded yet.' };
    } finally {
      device?.destroy?.();
    }
  } catch {
    return { ready: false, reason: 'The browser could not initialize WebGPU on this device.' };
  }
}
