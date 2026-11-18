const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
    const result=await page.evaluate(async()=>{
      const {validateCompressedCheckpoint}=await import('/src/lib/compressedRecordingCheckpoints.js');
      const context=new AudioContext(), oscillator=context.createOscillator();
      const output=context.createMediaStreamDestination();
      oscillator.frequency.value=330; oscillator.connect(output); oscillator.start();
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
      const recorder=new MediaRecorder(output.stream,{mimeType:mime,audioBitsPerSecond:192000});
      const pieces=[];
      recorder.ondataavailable=e=>{if(e.data.size)pieces.push(e.data);};
      recorder.start(200);
      await new Promise(resolve=>setTimeout(resolve,1750));
      const checkpoint=await validateCompressedCheckpoint(pieces.slice(),recorder.mimeType);
      recorder.stop();
      await new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
      oscillator.stop();await context.close();
      return {mime,partCount:pieces.length,checkpointDuration:checkpoint?.duration??null,
        checkpointBytes:checkpoint?.audio.size??0,finalBytes:pieces.reduce((s,p)=>s+p.size,0)};
    });
    console.log('MediaRecorder partial-checkpoint browser:',JSON.stringify(result));
    if(!result.partCount || result.finalBytes<1000)throw new Error('MediaRecorder did not capture test audio.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
