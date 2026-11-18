const {chromium,webkit,devices}=require('@playwright/test');
(async()=>{
 for(const [name,engine,device] of [['android-chromium',chromium,devices['Pixel 5']],['iphone-webkit',webkit,devices['iPhone 15']]]){
  const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try{
   const page=await browser.newPage(device);
   await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
   const result=await page.evaluate(async()=>{
    const {analyzeMobileMicLevel}=await import('/src/lib/mobileMicLevel.js');
    const {createMobileVocalCoach}=await import('/src/lib/mobileVocalCoach.js');
    const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain(),analyser=context.createAnalyser();
    osc.frequency.value=440;analyser.fftSize=1024;osc.connect(gain);gain.connect(analyser);osc.start();await context.resume();
    const measure=async(volume,count,coach)=>{
      gain.gain.setValueAtTime(volume,context.currentTime);
      const data=new Uint8Array(1024);
      for(let i=0;i<count;i++){
       await new Promise(resolve=>setTimeout(resolve,35));
       analyser.getByteTimeDomainData(data);
       coach.push(analyzeMobileMicLevel(data));
      }
      return coach.analyze();
    };
    const quiet=createMobileVocalCoach(),clip=createMobileVocalCoach(),good=createMobileVocalCoach();
    const results={quiet:(await measure(.003,12,quiet)).kind,clipping:(await measure(1,12,clip)).kind,
      normal:(await measure(.15,12,good)).kind};
    osc.stop();await context.close();return results;
   });
   console.log(name,JSON.stringify(result));
   if(result.quiet!=='quiet'||result.clipping!=='clipping'||result.normal!=='ready')
    throw new Error('Vocal assistant guidance failed real audio test');
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
