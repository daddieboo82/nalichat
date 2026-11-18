const {chromium,webkit,devices}=require('@playwright/test');
(async()=>{
  for (const [label,engine,profile] of [
    ['android-chromium',chromium,devices['Pixel 5']],
    ['iphone-webkit',webkit,devices['iPhone 15']],
  ]) {
    let browser;
    try {
      browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
      const page=await browser.newPage(profile);
      await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
      const result=await page.evaluate(async()=>{
        const {createPreferredStudioRecorder}=await import('/src/lib/studioPcmRecorder.js');
        const {studioRecoveryScope}=await import('/src/lib/studioTakeRecovery.js');
        const context=new AudioContext();
        const osc=context.createOscillator(),dest=context.createMediaStreamDestination();
        osc.connect(dest);osc.start();
        const details={
          audioWorklet:!!context.audioWorklet,mediaRecorder:typeof MediaRecorder,
          webm:MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus'),
          mp4:MediaRecorder.isTypeSupported?.('audio/mp4'),
          indexedDB:!!indexedDB,
          scope:studioRecoveryScope(null),
        };
        try {
          const {recorder,backend}=await createPreferredStudioRecorder(dest.stream);
          details.backend=backend;
          details.codec=recorder.mimeType;
          const blob=await new Promise((resolve,reject)=>{
            const chunks=[];
            recorder.ondataavailable=e=>chunks.push(e.data);
            recorder.onerror=e=>reject(new Error(e.error?.message||'Recording failure'));
            recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));
            recorder.start(200);
            setTimeout(()=>recorder.stop(),1250);
          });
          details.bytes=blob.size;
          details.decodedDuration=(await context.decodeAudioData(await blob.arrayBuffer())).duration;
        } catch (error) {details.error=String(error);}
        osc.stop(); await context.close();
        return details;
      });
      console.log(label,JSON.stringify(result));
      if(result.error || !result.bytes || result.decodedDuration<0.5)process.exitCode=2;
      await page.close();
    }catch(error){console.error(label,String(error).slice(0,450));process.exitCode=1;}
    finally{await browser?.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
