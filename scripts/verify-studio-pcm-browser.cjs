// Real Chromium smoke test of NaliChat's original lossless PCM worklet.
// Requires local Vite server at VOXSHIFT_LOCAL_ORIGIN or localhost:5173.
const { chromium } = require('@playwright/test');

(async () => {
  const origin = process.env.VOXSHIFT_LOCAL_ORIGIN || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const outbound = [];
    page.on('request', req => { if (!req.url().startsWith(origin)) outbound.push(req.url()); });
    await page.goto(origin + '/voxshift/rvc/LICENSE.txt', {waitUntil:'domcontentloaded'});
    const result = await page.evaluate(async () => {
      const {createPreferredStudioRecorder} = await import('/src/lib/studioPcmRecorder.js');
      const sourceContext = new AudioContext();
      const oscillator = sourceContext.createOscillator();
      const destination = sourceContext.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      oscillator.connect(destination);
      oscillator.start();
      try {
        const {recorder, lossless, backend} = await createPreferredStudioRecorder(destination.stream);
        const wav = await new Promise((resolve, reject) => {
          const pieces = [];
          recorder.ondataavailable = event => pieces.push(event.data);
          recorder.onerror = event => reject(new Error(event.error?.message || 'PCM capture error'));
          recorder.onstop = () => resolve(new Blob(pieces, {type:'audio/wav'}));
          recorder.start();
          setTimeout(() => {
            recorder.stop();
            // Simulate the Studio recorder's immediate stream stop.
            destination.stream.getTracks().forEach(track => track.stop());
          }, 440);
        });
        const bytes = await wav.arrayBuffer();
        const view = new DataView(bytes);
        const label = offset => String.fromCharCode(...new Uint8Array(bytes, offset, 4));
        return {
          backend, lossless, size: wav.size, sampleRate: view.getUint32(24,true),
          payloadSize: view.getUint32(40,true), format: label(8),
          pcm: view.getUint16(20,true), channels: view.getUint16(22,true),
        };
      } finally {
        oscillator.stop();
        await sourceContext.close();
      }
    });
    console.log('NaliChat PCM worklet:', JSON.stringify(result));
    console.log('External requests:', outbound.length);
    if (result.backend !== 'pcm-worklet' || !result.lossless ||
      result.format !== 'WAVE' || result.pcm !== 1 || result.channels !== 1 ||
      result.size < 5000 || result.size !== 44 + result.payloadSize || outbound.length) {
      throw new Error('PCM browser smoke test failed');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
