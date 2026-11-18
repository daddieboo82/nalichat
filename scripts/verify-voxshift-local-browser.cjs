// Real Chromium smoke test for the free local VoxShift worker.
// Run while the Base44 Vite development server is available:
//   node scripts/verify-voxshift-local-browser.cjs
// Invalid synthetic ONNX fixtures are intentional: this validates the worker
// and error handling without downloading weights or using hosted AI credits.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const origin = process.env.VOXSHIFT_LOCAL_ORIGIN || 'http://127.0.0.1:5173';
    await page.goto(origin + '/voxshift/rvc/LICENSE.txt', { waitUntil: 'domcontentloaded', timeout: 25000 });
    const outcome = await page.evaluate(async () => {
      const { runCancelableRvcWorker } = await import('/src/lib/rvcWorkerClient.js');
      const fakeFile = name => new File([new Uint8Array(5120)], name);
      const context = {
        workerUrl: location.origin + '/voxshift/rvc/inference.worker.js',
        wasmBaseUrl: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
      };
      const files = () => ({
        model: fakeFile('invalid-voice.onnx'),
        contentVec: fakeFile('invalid-feature.onnx'),
        rmvpe: fakeFile('invalid-pitch.onnx'),
      });

      let rejected = false;
      let reason = '';
      try {
        await runCancelableRvcWorker(context, files(), new Float32Array(16000), 16000, { timeout: 40000 });
      } catch (error) {
        rejected = true;
        reason = String(error?.message || error).slice(0, 300);
      }
      const controller = new AbortController();
      const running = runCancelableRvcWorker(
        context, files(), new Float32Array(16000), 16000,
        { signal: controller.signal, timeout: 40000 },
      );
      controller.abort();
      let cancelName = '';
      try {
        await running;
      } catch (error) {
        cancelName = error?.name;
      }
      return { rejected, reason, cancelName };
    });
    console.log('VoxShift browser worker:', JSON.stringify(outcome));
    if (!outcome.rejected || !outcome.reason || outcome.cancelName !== 'AbortError') {
      throw new Error('VoxShift browser smoke check failed');
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
