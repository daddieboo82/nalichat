import {describe,it,expect} from 'vitest';import{voxExportWindow}from './voxExportWindow.js';
describe('bounded spectral export scratch buffers',()=>{
 it.each([44100,48000,96000])('bounds a late two-second clip in a ten-minute session at %i Hz',rate=>{const range={when:500.123,endsAt:502.123};const w=voxExportWindow({},range,600*rate,rate);expect(w.origin%128).toBe(0);expect(w.first).toBe(Math.ceil(range.when*rate));expect(w.length).toBeLessThan(2*rate+4225);expect(w.end).toBeGreaterThanOrEqual(Math.ceil(range.endsAt*rate));expect(w.offset*rate).toBeCloseTo(w.first-w.origin);});
 it.each([{autoPolish:true},{automationPoints:[{time:1,value:50}]},{muteAutomationPoints:[{time:1,value:100}]}])('preserves absolute stateful rendering',track=>{const w=voxExportWindow(track,{when:2,endsAt:4},480000,48000);expect(w.origin).toBe(0);expect(w.length).toBe(480000);});
 it('never extends beyond session end',()=>{expect(voxExportWindow({}, {when:1,endsAt:2},96000,48000).end).toBe(96000);});
});
