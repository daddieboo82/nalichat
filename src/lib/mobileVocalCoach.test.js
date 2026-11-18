import {describe,it,expect} from 'vitest';
import {createMobileVocalCoach} from './mobileVocalCoach';
import {readFile} from 'node:fs/promises';

const frame=(rmsDb,peakDb=-12,clip=false)=>({rmsDb,peakDb,clip});
describe('mobile vocal coaching stays advisory and non-destructive',()=>{
  it('waits for sufficient signal before making a recommendation',()=>{
    const c=createMobileVocalCoach();
    c.push(frame(-28));
    expect(c.analyze().kind).toBe('learning');
  });
  it('requires repeat clipping, not one transient peak',()=>{
    const c=createMobileVocalCoach();
    for(let i=0;i<18;i++)c.push(frame(-18,-10));
    c.push(frame(-3,0,true));
    expect(c.analyze().kind).not.toBe('clipping');
    c.push(frame(-3,0,true));c.push(frame(-3,0,true));
    expect(c.analyze().kind).toBe('clipping');
  });
  it('flags possible sustained room noise only with supporting contrast',()=>{
    const c=createMobileVocalCoach();
    for(let i=0;i<30;i++)c.push(frame(i%2 ? -37 : -24,-14));
    expect(c.analyze().kind).toBe('noise');
    expect(c.analyze().help).toMatch(/estimate/i);
  });
  it('does not claim to detect specific noises or physical distance',()=>{
    const c=createMobileVocalCoach();
    for(let i=0;i<15;i++)c.push(frame(-60,-55));
    expect(c.analyze().kind).toBe('quiet');
    expect(c.analyze().help).toMatch(/cannot measure your exact distance/i);
  });
  it('resets the advice between different recording takes',()=>{
    const c=createMobileVocalCoach();
    for(let i=0;i<9;i++)c.push(frame(-20,-.1,true));
    expect(c.analyze().kind).toBe('clipping');
    c.reset();
    expect(c.analyze().kind).toBe('learning');
  });
  it('does not upload, modify gain, or train voices',async()=>{
    const source=await readFile('src/lib/mobileVocalCoach.js','utf8');
    expect(source).not.toMatch(/secureUpload|\.gain\.|MediaRecorder|trainPrivateNaliVoice/);
    const studio=await readFile('src/pages/Studio.jsx','utf8');
    expect(studio).toContain('mobileCoachRef.current.push(level)');
    expect(studio).toContain('aria-label="Mobile vocal recording assistant"');
  });
});
