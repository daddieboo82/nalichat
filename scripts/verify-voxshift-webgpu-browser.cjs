// Real Chromium smoke test of VoxShift's free on-device WebGPU DSP.
// Requires local Base44 Vite server and Playwright Chromium installed.
// VOXSHIFT_LOCAL_ORIGIN may override http://127.0.0.1:5173.
// The test requests Chromium's software WebGPU adapter; it does NOT validate a physical GPU.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
      '--use-angle=swiftshader', '--disable-vulkan-surface'],
  });
  try {
    const page = await browser.newPage();
    const origin = process.env.VOXSHIFT_LOCAL_ORIGIN || 'http://127.0.0.1:5173';
    await page.goto(origin + '/voxshift/rvc/LICENSE.txt', { waitUntil: 'domcontentloaded', timeout: 25000 });
    const result = await page.evaluate(async () => {
      const { gpuVocalGain, cpuVocalGain } = await import('/src/lib/voxGpuProcessing.js');
      const samples = new Float32Array(131073);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * .011) * 0.7;
      const actual = await gpuVocalGain(samples, 1.7);
      const expected = cpuVocalGain(samples, 1.7);
      let maxError = 0;
      for (let i = 0; i < samples.length; i++) {
        maxError = Math.max(maxError, Math.abs(actual.samples[i] - expected[i]));
      }
      const fallback = await gpuVocalGain(Float32Array.from([0.4, -0.9]), 2, { gpu: null });
      return {
        webgpuAvailable: Boolean(navigator.gpu),
        backend: actual.backend,
        maxError,
        sampleCount: actual.samples.length,
        peak: Math.max(...actual.samples.subarray(0, 256)),
        cpuFallback: fallback.backend,
        cpuFallbackValues: Array.from(fallback.samples),
      };
    });
    console.log('VoxShift browser WebGPU:', JSON.stringify(result));
    if (result.backend !== 'webgpu'
      || result.sampleCount !== 131073
      || result.maxError > 0.00001
      || result.cpuFallback !== 'cpu'
      || Math.abs(result.cpuFallbackValues[0] - 0.8) > 0.00001
      || Math.abs(result.cpuFallbackValues[1] + 0.93) > 0.00001) {
      throw new Error('VoxShift WebGPU browser check failed');
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
