// Real Chromium worker integration for NaliChat original cross-device sync.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const localChromium = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
    ...(fs.existsSync(localChromium) ? { executablePath: localChromium } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173/audio/nali-latency-probe.worklet.js');
    const result = await page.evaluate(async () => {
      const { estimateSharedTrackSync } = await import('/src/lib/sessionSyncAssist.js');
      let seed = 0x534e4341;
      const guide = new Float32Array(20000);
      for (let i = 0; i < guide.length; i++) {
        seed = (Math.imul(seed,1664525)+1013904223)>>>0;
        guide[i] = (seed/4294967296-.5)*.5;
      }
      const matching = new Float32Array(guide.length);
      for (let i = 0; i < matching.length; i++) matching[i] = guide[i+175] || 0;
      const worker = new Worker(new URL('/src/lib/sessionSyncAssist.worker.js', location.origin), { type:'module' });
      try {
        const run = (reference, target) => new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data.result);
          worker.onerror = () => reject(new Error('Worker crashed'));
          worker.postMessage({type:'analyze',reference:reference.buffer,target:target.buffer,
            sampleRate:1000,referenceStart:0,targetStart:0}, [reference.buffer,target.buffer]);
        });
        const good = await run(guide.slice(), matching);
        const unrelated = Float32Array.from({length:guide.length},(_,i)=>Math.sin(i*.12)*.22);
        const bad = await run(guide.slice(), unrelated);
        const invalid = estimateSharedTrackSync({reference:new Float32Array(1000),target:new Float32Array(1000)});
        return { good, bad, invalid };
      } finally { worker.terminate(); }
    });
    console.log('NaliChat browser sync worker:',JSON.stringify(result));
    if (!result.good.valid || Math.abs(result.good.suggestedStart-.175)>.005 ||
        result.bad.valid || result.invalid.valid) throw new Error('Worker sync check failed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
