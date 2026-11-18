const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
    const before=await page.evaluate(async()=>{
      const {createLosslessStudioRecorder}=await import('/src/lib/studioPcmRecorder.js');
      const {startMobileRecordingCheckpoints}=await import('/src/lib/mobileRecordingCheckpoints.js');
      const ctx=new AudioContext();
      const oscillator=ctx.createOscillator();
      const destination=ctx.createMediaStreamDestination();
      oscillator.frequency.value=440; oscillator.connect(destination);oscillator.start();
      const recorder=await createLosslessStudioRecorder(destination.stream);
      recorder.start();
      await new Promise(r=>setTimeout(r,1550));
      const first=recorder.snapshot();
      const firstSize=first?.size||0;
      const ctl=startMobileRecordingCheckpoints({
        recorder,ownerId:'mobile-e2e-user',scope:'draft',id:'mobile-checkpoint-0001',
        name:'Browser mic',startTime:0,schedule:()=>0,unschedule:()=>{},
      });
      ctl.tick();await ctl.wait();
      await new Promise(r=>setTimeout(r,450));
      const secondSize=recorder.snapshot()?.size||0;
      ctl.stop();
      recorder.dispose();
      oscillator.stop(); await ctx.close();
      return {firstSize,secondSize};
    });
    await page.reload();
    const restored=await page.evaluate(async()=>{
      const {getStudioRecoveryTake,listStudioRecoveryTakes,deleteStudioRecoveryTake}=await import('/src/lib/studioTakeRecovery.js');
      const list=await listStudioRecoveryTakes('mobile-e2e-user','draft');
      const recovered=await getStudioRecoveryTake('mobile-e2e-user','draft','mobile-checkpoint-0001');
      const ctx=new AudioContext();
      const bytes=await recovered.audio.arrayBuffer();
      const decoded=await ctx.decodeAudioData(bytes.slice(0));
      await ctx.close();
      await deleteStudioRecoveryTake('mobile-e2e-user','draft','mobile-checkpoint-0001');
      return {listed:list.length,partial:list[0]?.partial,bytes:bytes.byteLength,duration:decoded.duration,sampleRate:decoded.sampleRate};
    });
    console.log('Mobile Studio incremental PCM recovery:',JSON.stringify({before,restored}));
    if(before.firstSize<10000 || before.secondSize<=before.firstSize || restored.listed!==1 ||
       restored.partial!==true || restored.duration<1 || restored.bytes<10000)throw new Error('Incomplete checkpoint recovery');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
