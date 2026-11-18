const {chromium,webkit,devices}=require('@playwright/test');
(async()=>{
  for (const [name,engine,device] of [['android-chromium',chromium,devices['Pixel 5']],['iphone-webkit',webkit,devices['iPhone 15']]]) {
    const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
    try {
      const page=await browser.newPage(device);
      await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
      const result=await page.evaluate(async()=>{
        const {runMobileStudioPreflight}=await import('/src/lib/mobileStudioPreflight.js');
        const context=new AudioContext(),osc=context.createOscillator(),dest=context.createMediaStreamDestination();
        osc.connect(dest);osc.start();
        const track=dest.stream.getAudioTracks()[0];
        const result=await runMobileStudioPreflight({openMicrophone:async()=>dest.stream});
        const after=track.readyState;
        osc.stop();await context.close();
        return {result,after};
      });
      console.log(name,JSON.stringify(result));
      if(result.result.microphone!=='ready'||result.result.recordingEngine!=='lossless-wav'||result.after!=='ended') throw Error('Preflight failed or microphone remained active');
      await page.close();
    } finally {await browser.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
