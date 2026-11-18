import { describe,expect,it } from 'vitest';
import { analyzeMobileMicLevel,mobileMicLevelMessage } from './mobileMicLevel';
import { readFile } from 'node:fs/promises';

describe('mobile microphone input feedback',()=>{
  it('reports silence as quiet, never clipping',()=>{
    const v=analyzeMobileMicLevel(new Uint8Array(1024).fill(128));
    expect(v).toMatchObject({rmsDb:-90,peakDb:-90,clip:false,quiet:true,level:0});
    expect(mobileMicLevelMessage(v).title).toMatch(/quiet/i);
  });
  it('identifies reasonable input with headroom',()=>{
    const input=Float32Array.from({length:1024},(_,i)=>Math.sin(2*Math.PI*i/32)*0.18);
    const v=analyzeMobileMicLevel(input);
    expect(v.rmsDb).toBeGreaterThan(-25);
    expect(v.peakDb).toBeLessThan(-6);
    expect(v.clip).toBe(false);
    expect(mobileMicLevelMessage(v).severity).toBe('good');
  });
  it('warns about near full-scale clipping',()=>{
    const data=Float32Array.from({length:1024},(_,i)=>i%2?0.995:-0.995);
    const result=analyzeMobileMicLevel(data);
    expect(result.clip).toBe(true);
    expect(mobileMicLevelMessage(result).title).toMatch(/clipping/i);
  });
  it('reads browser byte-domain signals correctly without confusing 128 with a loud sample',()=>{
    const quiet=analyzeMobileMicLevel(Uint8Array.from({length:256},(_,i)=>i%2?129:127));
    expect(quiet.quiet).toBe(true);
    const loud=analyzeMobileMicLevel(Uint8Array.from({length:256},(_,i)=>i%2?255:0));
    expect(loud.clip).toBe(true);
    expect(mobileMicLevelMessage(loud).severity).toBe('danger');
  });
  it('does not modify recorded microphone data or monitoring volume',async()=>{
    const studio=await readFile('src/pages/Studio.jsx','utf8');
    const start=studio.indexOf('// Read the existing muted-monitor analyser;');
    expect(start).toBeGreaterThan(0);
    const end=studio.indexOf('const mobileCaptureAutoFinishRef',start);
    const meter=studio.slice(start,end);
    expect(meter).toContain('analyser.getByteTimeDomainData(samples)');
    expect(meter).not.toContain('.gain.');
    expect(meter).not.toContain('secureUploadFile');
    expect(studio).toContain('aria-label="Live microphone input meter"');
  });
});
