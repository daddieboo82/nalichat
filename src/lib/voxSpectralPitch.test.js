import { describe, it, expect } from 'vitest';
import { voxSpectralPitch } from './voxSpectralPitch.js';
const rate=24000;
const tone=(freq,length=rate*2)=>Float32Array.from({length},(_,i)=>0.25*Math.sin(2*Math.PI*freq*i/rate));
function dominant(samples,target){
  const data=samples.subarray(rate/2,rate*1.5);let best=-1,chosen=0;
  for(let f=Math.round(target)-12;f<=Math.round(target)+12;f+=0.5){
    let re=0,im=0;for(let i=0;i<data.length;i+=4){const v=data[i]*(0.5-0.5*Math.cos(2*Math.PI*i/data.length));const w=2*Math.PI*f*i/rate;re+=v*Math.cos(w);im+=v*Math.sin(w);}
    const power=re*re+im*im;if(power>best){best=power;chosen=f;}
  }
  return chosen;
}
describe('experimental spectral pitch',()=>{
  it.each([0.5,0.6,0.72,0.85,1,1.15,1.38,1.6])('retains duration and shifts 440 Hz by %s',ratio=>{
    const input=tone(440),out=voxSpectralPitch(input,ratio);
    expect(out.length).toBe(input.length);expect(out.every(Number.isFinite)).toBe(true);
    expect(Math.abs(1200*Math.log2(dominant(out,440*ratio)/(440*ratio)))).toBeLessThan(5);
    expect(out.some(x=>Math.abs(x)>0.01)).toBe(true);
  });
  it('preserves exact bypass samples without aliasing input',()=>{const input=tone(440,1024),out=voxSpectralPitch(input,1);expect(out).not.toBe(input);expect(out).toEqual(input);});
  it('keeps silence silent',()=>{expect(voxSpectralPitch(new Float32Array(4096),1.3).every(x=>x===0)).toBe(true);});
  it('does not mutate source samples',()=>{const input=tone(220,4096),copy=input.slice();voxSpectralPitch(input,0.8);expect(input).toEqual(copy);});
  it('rejects invalid settings',()=>{expect(()=>voxSpectralPitch(tone(440,32),NaN)).toThrow();expect(()=>voxSpectralPitch(tone(440,32),1.2,{frameSize:100})).toThrow();});
});
