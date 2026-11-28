import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/pages/Studio.jsx','utf8');
const block=source.slice(source.indexOf('if(spectralEnabled && monitorRequestedRef.current){'),source.indexOf('recordingOverdubRef.current.hasBackingTrack = false;',source.indexOf('if(spectralEnabled && monitorRequestedRef.current){')));
describe('monitor startup ordering',()=>{
 it('checks startup token and epoch after a rejected monitor setup',()=>{const guard=block.slice(block.indexOf('// A rejected monitor initialization'),block.indexOf('mediaRecorderRef.current = mediaRecorder'));expect(guard).toContain('microphoneStartupRef.current.token!==startupToken');expect(guard).toContain('historyEpochRef.current!==startupEpoch');expect(guard).toContain("throw new Error('Recording startup superseded')");});
 it('only changes monitor preference for the current attempt',()=>{const failure=block.slice(block.indexOf("console.warn('Headphone monitor unavailable:'"),block.indexOf('// A rejected monitor initialization'));expect(failure).toContain('microphoneStartupRef.current.token===startupToken');expect(failure).toContain('historyEpochRef.current===startupEpoch');expect(failure).toContain('monitorRequestedRef.current=false');});
 it('enables monitor only after successful recorder start',()=>{expect(block.indexOf('mediaRecorder.start(200)')).toBeGreaterThanOrEqual(0);expect(block.indexOf('startupMonitor.setLevel(.15)')).toBeGreaterThan(block.indexOf('mediaRecorder.start(200)'));expect(block).toContain('spectralMonitorRef.current===startupMonitor && monitorRequestedRef.current');});
});
