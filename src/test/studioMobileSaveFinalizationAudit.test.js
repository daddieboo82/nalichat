import { describe,expect,it } from 'vitest';
import {readFile} from 'node:fs/promises';
describe('Studio mobile finalization save audit',()=>{
 it('blocks every save entry point until the microphone finalization completes',async()=>{
  const src=await readFile('src/pages/Studio.jsx','utf8');
  const begin=src.indexOf('  const handleSave = async () => {');
  const end=src.indexOf('    studioSaveInFlightRef.current = true;',begin);
  expect(begin).toBeGreaterThan(0);
  const gate=src.slice(begin,end);
  expect(gate).toContain('recordingFinalizeInFlightRef.current');
  expect(gate).toContain('microphoneStartupRef.current.pending');
  expect(gate).toContain('isRecording');
  expect(gate).toContain('mobileTakeFinalizing');
  expect(gate).toContain('return false;');
  expect(gate.indexOf('recordingFinalizeInFlightRef.current')).toBeLessThan(gate.indexOf('studioDeviceExportInFlightRef.current'));
  expect(src).toContain('disabled={isRecording || mobileTakeFinalizing || mobileHandoffSaving} onClick={handleSave}');
  expect(src).toContain('disabled={mobileHandoffSaving || isRecording || mobileTakeFinalizing || !canEditProject}');
 });
 it('preserves existing recording stop/finalize actions and cloud save confirmation',async()=>{
  const src=await readFile('src/pages/Studio.jsx','utf8');
  expect(src).toContain('stoppedRecorder.onstop = async () =>');
  expect(src).toContain('setMobileTakeFinalizing(false)');
  expect(src).toContain('const saved = await base44.functions.invoke("mutateProject"');
  expect(src).toContain('lastSavedStudioProjectRef.current = targetProjectId');
 });
});
