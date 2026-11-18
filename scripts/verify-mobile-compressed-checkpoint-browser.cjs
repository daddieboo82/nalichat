const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
    const live=await page.evaluate(async()=>{
      const {startCompressedRecordingCheckpoints}=await import('/src/lib/compressedRecordingCheckpoints.js');
      const context=new AudioContext(), oscillator=context.createOscillator();
      const output=context.createMediaStreamDestination();
      oscillator.frequency.value=330; oscillator.connect(output); oscillator.start();
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
      const recorder=new MediaRecorder(output.stream,{mimeType:mime,audioBitsPerSecond:192000});
      const pieces=[];
      recorder.ondataavailable=e=>{if(e.data.size)pieces.push(e.data);};
      let refresh=()=>{};
      const ctl=startCompressedRecordingCheckpoints({
        recorder,chunks:pieces,ownerId:'mobile-compressed-e2e',scope:'draft',
        id:'checkpoint-compressed-0001',name:'Opus lead vocal',startTime:0,
        schedule:fn=>{refresh=fn;return 1},unschedule:()=>{},
      });
      recorder.start(200);
      await new Promise(resolve=>setTimeout(resolve,1850));
      refresh();await ctl.wait();
      ctl.stop();
      const preStopCount=pieces.length;
      recorder.stop();
      await new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
      oscillator.stop();await context.close();
      return {mime,preStopCount};
    });
    await page.reload();
    const restored=await page.evaluate(async()=>{
      const {getStudioRecoveryTake,listStudioRecoveryTakes,deleteStudioRecoveryTake}=await import('/src/lib/studioTakeRecovery.js');
      const list=await listStudioRecoveryTakes('mobile-compressed-e2e','draft');
      if(!list.length)return {listed:0};
      const item=await getStudioRecoveryTake('mobile-compressed-e2e','draft','checkpoint-compressed-0001');
      const context=new AudioContext();
      const decoded=await context.decodeAudioData(await item.audio.arrayBuffer());
      await context.close();
      await deleteStudioRecoveryTake('mobile-compressed-e2e','draft','checkpoint-compressed-0001');
      return {listed:list.length,partial:item.partial,bytes:item.audio.size,duration:decoded.duration,mime:item.audio.type};
    });
    console.log('MediaRecorder interruption checkpoint after browser reload:',JSON.stringify({live,restored}));
    if(!live.preStopCount || restored.listed!==1 || restored.partial!==true || restored.duration<1)throw new Error('Compressed recording recovery failed');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
