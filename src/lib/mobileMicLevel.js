// Input metering observes existing microphone analyser; never affects recorded PCM.
export function analyzeMobileMicLevel(samples) {
  if (!samples?.length) return {rmsDb:-90,peakDb:-90,level:0,clip:false,quiet:true};
  let squared=0,peak=0;
  const byteMode=samples instanceof Uint8Array || samples instanceof Uint8ClampedArray;
  for(let i=0;i<samples.length;i++) {
    const raw=Number(samples[i]);
    const sample=byteMode?(raw-128)/128:raw;
    if(!Number.isFinite(sample)) continue;
    peak=Math.max(peak,Math.abs(sample));
    squared+=sample*sample;
  }
  const rms=Math.sqrt(squared/samples.length);
  const toDb=value=>value>0?Math.max(-90,20*Math.log10(value)):-90;
  const rmsDb=toDb(rms),peakDb=toDb(peak);
  return {
    rmsDb:Math.round(rmsDb),
    peakDb:Math.round(peakDb),
    level:Math.min(100,Math.max(0,Math.round((rmsDb+60)/60*100))),
    clip:peak>=0.98,
    quiet:rmsDb<-42,
  };
}

export function mobileMicLevelMessage({rmsDb=-90,peakDb=-90,clip=false,quiet=true}={}) {
  if(clip || peakDb>=-1) return {severity:'danger',title:'Too loud — clipping risk',
    help:'Move the phone farther from your mouth or lower external microphone gain. Distortion cannot always be repaired.'};
  if(quiet) return {severity:'warning',title:'Input is very quiet',
    help:'Move closer to the microphone and speak at recording volume. Do not cover the microphone.'};
  if(peakDb>=-6) return {severity:'warning',title:'Strong input — watch peaks',
    help:'Leave a little headroom for louder words and singing.'};
  return {severity:'good',title:'Healthy input level',
    help:'Your microphone signal has headroom. Use headphones to prevent feedback.'};
}
