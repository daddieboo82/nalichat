const {chromium,webkit,devices}=require('@playwright/test');
(async()=>{
  for(const [name,engine,device] of [['android-chromium',chromium,devices['Pixel 5']],['iphone-webkit',webkit,devices['iPhone 15']]]){
    const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
    try{
      const page=await browser.newPage(device);
      await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
      const result=await page.evaluate(async()=>{
        const {analyzeMobileMicLevel,mobileMicLevelMessage}=await import('/src/lib/mobileMicLevel.js');
        const context=new AudioContext();
        const oscillator=context.createOscillator(), gain=context.createGain();
        const analyser=context.createAnalyser();
        analyser.fftSize=1024;
        oscillator.frequency.value=440;
        oscillator.connect(gain);gain.connect(analyser);
        oscillator.start();await context.resume();
        const values=[];
        for(const amplitude of [0.005,0.15,0.995]){
          gain.gain.setValueAtTime(amplitude,context.currentTime);
          await new Promise(resolve=>setTimeout(resolve,200));
          const data=new Uint8Array(1024);
          analyser.getByteTimeDomainData(data);
          const level=analyzeMobileMicLevel(data);
          values.push({amplitude,...level,guidance:mobileMicLevelMessage(level).severity});
        }
        oscillator.stop();await context.close();
        return values;
      });
      console.log(name,JSON.stringify(result));
      if(result[0].guidance!=='warning'||result[1].guidance!=='good'||result[2].guidance!=='danger')
        throw new Error('Mobile input levels did not reflect actual audio');
    }finally{await browser.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1});
