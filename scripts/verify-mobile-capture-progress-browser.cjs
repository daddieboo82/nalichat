const {chromium,webkit,devices}=require('@playwright/test');
(async()=>{
  for (const [name,engine,device] of [['android-chromium',chromium,devices['Pixel 5']],['iphone-webkit',webkit,devices['iPhone 15']]]) {
    const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
    try{
      const page=await browser.newPage(device);
      await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
      const value=await page.evaluate(async()=>{
        const {createPreferredStudioRecorder}=await import('/src/lib/studioPcmRecorder.js');
        const {studioCaptureHealth,shouldFinalizeMobilePcm}=await import('/src/lib/studioCaptureHealth.js');
        const context=new AudioContext(),osc=context.createOscillator(),dest=context.createMediaStreamDestination();
        osc.connect(dest);osc.start();
        const {recorder}=await createPreferredStudioRecorder(dest.stream,{MediaRecorderType:globalThis.MediaRecorder});
        recorder.start(200);
        await new Promise(resolve=>setTimeout(resolve,1550));
        const bytes=recorder.capturedByteLength;
        const snapshot=recorder.snapshot?.();
        const status=studioCaptureHealth({elapsedSeconds:1.5,checkpointSeconds:1.1,pcm:true,capturedBytes:bytes});
        const trigger=shouldFinalizeMobilePcm(bytes,true);
        await new Promise((resolve,reject)=>{
          recorder.onstop=resolve;
          recorder.onerror=event=>reject(event.error||new Error('capture failure'));
          recorder.stop();
        });
        osc.stop();await context.close();
        return {bytes,snapshotBytes:snapshot?.size,display:status.elapsedLabel,saved:status.checkpointLabel,trigger};
      });
      console.log(name,JSON.stringify(value));
      if(!value.bytes || value.snapshotBytes<30000 || value.display!=='00:01' || value.saved!=='00:01' || value.trigger) throw Error('Unexpected mobile capture stats');
    }finally{await browser.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1});
