const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173/audio/nali-latency-probe.worklet.js');
    await page.setContent('<button id="guide">Start count-in</button>');
    const result = await page.evaluate(async () => {
      const {startSharedSessionGuide,sharedGuideSchedule} = await import('/src/lib/sharedSessionGuide.js');
      return await new Promise((resolve, reject) => {
        document.querySelector('#guide').onclick = async () => {
          try {
            const guide = await startSharedSessionGuide();
            const seconds = guide.durationSeconds;
            guide.stop();
            resolve({ seconds, schedule:sharedGuideSchedule().map(x=>x.seconds) });
          } catch(error) { reject(error); }
        };
        document.querySelector('#guide').click();
      });
    }).catch(error=>({failure:String(error)}));
    if (result.failure) throw new Error(result.failure);
    console.log('NaliChat browser count-in:', JSON.stringify(result));
    if (result.seconds !== 2 || result.schedule.join(',') !== '0,0.5,1,1.5') throw new Error('Incorrect recording count-in');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
