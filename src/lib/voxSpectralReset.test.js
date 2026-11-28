import {describe,it,expect} from 'vitest';
import {createVoxSpectralStream} from './voxSpectralPitch.js';
describe('spectral discontinuity reset',()=>{
  for(const mode of ['recording','mixing','rendering']) for(const ratio of [0.72,1,1.38]) it(`${mode} ${ratio}: reset equals fresh stream`,()=>{
    const options={mode,sampleRate:48000};const stream=createVoxSpectralStream(ratio,options),fresh=createVoxSpectralStream(ratio,options);
    const old=Float32Array.from({length:7777},(_,i)=>.8*Math.sin(i*.071));stream.process(old,new Float32Array(old.length));
    stream.reset();stream.reset();const next=Float32Array.from({length:8192},(_,i)=>.1*Math.sin(i*.043)),a=new Float32Array(next.length),b=new Float32Array(next.length);
    stream.process(next,a);fresh.process(next,b);expect(a).toEqual(b);expect(a.subarray(0,stream.latencySamples).every(x=>x===0)).toBe(true);
  });
  it('discards a pending tail even when next input is silent',()=>{const s=createVoxSpectralStream(1.4,{mode:'rendering'}),a=new Float32Array(4096).fill(.5);s.process(a,new Float32Array(a.length));s.reset();const y=new Float32Array(8192);s.process(new Float32Array(y.length),y);expect(y.every(x=>x===0)).toBe(true);});
});
