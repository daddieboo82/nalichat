import { voxPitchRatio } from './voxShift.js';
import { voxSpectralPitch } from './voxSpectralPitch.js';

// Explicit offline option: process only the selected source region, then feed
// the existing Studio channel strip with its main pitch stage neutralized.
// Preset tone, output gain and parallel legacy layers remain intact.
export async function prepareSpectralClip(context, track, buffer, range) {
  const effects=track.effects || track.plugins || {};
  const vox=effects.voxshift;
  const ratio=voxPitchRatio(vox?.params);
  if (!vox || vox.enabled===false || ratio===1) return {track,buffer,range};
  const rate=buffer.sampleRate;
  const first=Math.min(buffer.length,Math.max(0,Math.round(range.offset*rate)));
  const frames=Math.min(buffer.length-first,Math.max(1,Math.round(range.duration*rate)));
  if(frames<=0)return {track,buffer,range};
  const output=context.createBuffer(buffer.numberOfChannels,frames,rate);
  for(let c=0;c<buffer.numberOfChannels;c++){
    const pcm=buffer.getChannelData(c).subarray(first,first+frames);
    output.copyToChannel(voxSpectralPitch(pcm,ratio,{mode:'rendering',sampleRate:rate}),c);
  }
  const nextEffects={...effects,voxshift:{...vox,params:{...vox.params,Pitch:100}}};
  return {track:{...track,effects:nextEffects},buffer:output,range:{...range,offset:0,duration:Math.min(range.duration,output.duration)}};
}
