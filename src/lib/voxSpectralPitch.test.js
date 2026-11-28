import { describe, it, expect } from 'vitest';
import { voxSpectralPitch, createVoxSpectralStream } from './voxSpectralPitch.js';
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

describe('optional formant envelope correction',()=>{
  const envelope=f=>0.04+Math.exp(-0.5*((f-700)/180)**2)+0.65*Math.exp(-0.5*((f-1900)/260)**2);
  const vowel=()=>Float32Array.from({length:rate*2},(_,i)=>{let sum=0;for(let h=1;h<=40;h++)sum+=0.045*envelope(h*100)*Math.sin(2*Math.PI*h*100*i/rate);return sum;});
  function envelopeError(output,ratio){const amplitudes=[];for(let h=1;h<=Math.floor(3600/(100*ratio));h++){let re=0,im=0;const f=h*100*ratio;for(let i=0;i<rate;i+=4){const w=2*Math.PI*f*i/rate,v=output[rate/2+i]*(0.5-0.5*Math.cos(2*Math.PI*i/rate));re+=v*Math.cos(w);im+=v*Math.sin(w);}amplitudes.push({actual:Math.hypot(re,im),expected:envelope(f)});}const sa=amplitudes.reduce((s,p)=>s+p.actual,0),se=amplitudes.reduce((s,p)=>s+p.expected,0);return Math.sqrt(amplitudes.reduce((s,p)=>s+(p.actual/sa-p.expected/se)**2,0)/amplitudes.reduce((s,p)=>s+(p.expected/se)**2,0));}
  it.each([0.75,1.25,1.5])('reduces synthetic resonance error at ratio %s',ratio=>{const x=vowel(),base=voxSpectralPitch(x,ratio,{sampleRate:rate}),out=voxSpectralPitch(x,ratio,{sampleRate:rate,formantStrength:1});expect(out.length).toBe(x.length);expect(out.every(Number.isFinite)).toBe(true);expect(envelopeError(out,ratio)).toBeLessThan(envelopeError(base,ratio)*0.65);});
  it('keeps corrected silence silent',()=>expect(voxSpectralPitch(new Float32Array(4096),0.7,{formantStrength:1}).every(x=>x===0)).toBe(true));
  it('rejects invalid envelope controls',()=>{expect(()=>voxSpectralPitch(tone(440,32),1.2,{formantStrength:2})).toThrow();expect(()=>voxSpectralPitch(tone(440,32),1.2,{sampleRate:0})).toThrow();});
});

 describe('streaming spectral processor',()=>{
  it.each([0.5,0.72,1,1.38,1.6])('matches offline for irregular blocks at ratio %s',ratio=>{
    const x=tone(220,8193),options={formantStrength:0.7,sampleRate:rate};
    const stream=createVoxSpectralStream(ratio,options),delay=stream.latencySamples;
    const padded=new Float32Array(x.length+delay),out=new Float32Array(padded.length);padded.set(x);
    for(let i=0;i<padded.length;){const end=Math.min(padded.length,i+(i%137)+1);stream.process(padded.subarray(i,end),out.subarray(i,end));i=end;}
    expect(out.subarray(0,delay).every(x=>x===0)).toBe(true);
    expect(out.subarray(delay)).toEqual(voxSpectralPitch(x,ratio,options));
  });
  it('preserves identity signal after fixed delay',()=>{const x=tone(440,4096),s=createVoxSpectralStream(1),inBlock=new Float32Array(x.length+s.latencySamples),out=new Float32Array(inBlock.length);inBlock.set(x);s.process(inBlock,out);expect(out.subarray(s.latencySamples)).toEqual(x);});
  it('rejects mismatched input/output lengths',()=>expect(()=>createVoxSpectralStream(1.2).process(new Float32Array(128),new Float32Array(64))).toThrow());
});

describe('spectral processing modes and level stabilization',()=>{
  it.each([['recording',512],['mixing',1024],['rendering',2048]])('supports %s with %i samples of delay',(mode,delay)=>{
    const x=tone(440,rate*2), options={mode,sampleRate:rate};
    const s=createVoxSpectralStream(1.6,options);expect(s.latencySamples).toBe(delay);
    const base=voxSpectralPitch(x,1.6,{...options,levelStrength:0}),out=voxSpectralPitch(x,1.6,options);
    const rms=a=>Math.sqrt(a.subarray(rate,rate*1.8).reduce((sum,v)=>sum+v*v,0)/(rate*.8));
    const error=a=>Math.abs(20*Math.log10(rms(a)/rms(x)));
    expect(error(out)).toBeLessThan(error(base));expect(out.every(Number.isFinite)).toBe(true);
    const padded=new Float32Array(x.length+delay),streamed=new Float32Array(padded.length);padded.set(x);
    for(let i=0;i<padded.length;i+=128)s.process(padded.subarray(i,i+128),streamed.subarray(i,i+128));
    expect(streamed.subarray(delay)).toEqual(out);
  });
  it('preserves silence with stabilization',()=>expect(voxSpectralPitch(new Float32Array(4096),1.4,{mode:'recording'}).every(v=>v===0)).toBe(true));
  it('rejects invalid mode and level controls',()=>{expect(()=>createVoxSpectralStream(1.2,{mode:'unknown'})).toThrow();expect(()=>createVoxSpectralStream(1.2,{levelStrength:2})).toThrow();});
});
