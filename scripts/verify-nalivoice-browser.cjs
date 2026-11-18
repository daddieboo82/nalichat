// Real Chromium smoke test: NaliVoice's own browser worker does not upload
// vocal audio or download third-party voice models.
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const outbound = [];
    page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:5173/')) outbound.push(req.url()); });
    await page.goto('http://127.0.0.1:5173/voxshift/rvc/LICENSE.txt', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const { runNaliVoiceWorker } = await import('/src/lib/naliVoiceWorkerClient.js');
      const samples = Float32Array.from({length: 16000}, (_, i) => Math.sin(i * Math.PI / 29) * 0.2);
      const out = await runNaliVoiceWorker(samples);
      return { length: out.length, valid: out.every(Number.isFinite), max: out.reduce((m, x) => Math.max(m, Math.abs(x)), 0) };
    });
    console.log('NaliVoice browser result:', JSON.stringify(result));
    console.log('External HTTP requests:', outbound.length);
    if (result.length !== 16000 || !result.valid || result.max > 0.98 || outbound.length) {
      throw new Error('NaliVoice real browser smoke test did not pass');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
