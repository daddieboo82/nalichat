import {createVoxSpectralStream} from './voxSpectralPitch.js';
// Conservative main-thread proxy, not a measurement of audio-thread deadlines.
// Never raise the default workload on the strength of a synthetic benchmark.
export function measureVoxDeviceCosts({sampleRate=48000,now=()=>performance.now(),blocks=96,warmup=16,createStream=createVoxSpectralStream}={}){
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000||!Number.isSafeInteger(blocks)||blocks<32||blocks>512||!Number.isSafeInteger(warmup)||warmup<0||warmup>128)throw RangeError('Invalid calibration settings');
  const input=Float32Array.from({length:128},(_,i)=>.15*Math.sin(i*.17)+.06*Math.cos(i*.39)),output=new Float32Array(128),costs={};
  for(const mode of ['recording','mixing','rendering']){
    const streams=[createStream(.75,{mode,sampleRate}),createStream(1.35,{mode,sampleRate})];
    const times=[];
    for(let i=0;i<blocks+warmup;i++){
      const start=now();for(const stream of streams)stream.process(input,output);const elapsed=now()-start;
      if(!Number.isFinite(elapsed)||elapsed<0)throw Error('Invalid calibration clock');
      if(i>=warmup)times.push(elapsed);
    }
    times.sort((a,b)=>a-b);
    // p95 stereo cost / 2, with additional 25% safety margin.
    costs[mode]=times[Math.ceil(times.length*.95)-1]*.625;
  }
  return {sampleRate,costs,method:'main-thread-proxy-v1'};
}
