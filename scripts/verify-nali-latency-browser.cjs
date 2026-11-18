const {chromium} = require('/app/node_modules/@playwright/test');
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
   const page = await browser.newPage();
   await page.goto('http://127.0.0.1:5173/audio/nali-latency-probe.worklet.js');
   const result = await page.evaluate(async() => {
     const {calibrateNaliStudioLatency} = await import('/src/lib/naliLatencyCalibration.js');
     const ctx = new AudioContext({latencyHint:'interactive'});
     const micDestination = ctx.createMediaStreamDestination();
     const delay = ctx.createDelay(0.5);
     delay.delayTime.value = .114;
     delay.connect(micDestination);
     const gain = ctx.createGain.bind(ctx);
     ctx.createGain = () => {
       const node = gain(), connect = node.connect.bind(node);
       node.connect = function(dest, ...args) {
         if (dest === ctx.destination && this.gain.value === 1) connect(delay);
         return connect(dest,...args);
       };
       return node;
     };
     const output = await calibrateNaliStudioLatency({
       mediaDevices:{getUserMedia:async()=>micDestination.stream},
       AudioContextType: function() {return ctx;},
       AudioWorkletNodeType: AudioWorkletNode,
     });
     return output;
   });
   console.log('BROWSER_LATENCY_RESULT',JSON.stringify(result));
   if (!result.valid || Math.abs(result.roundTripMs-114)>40) process.exitCode=2;
 } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
