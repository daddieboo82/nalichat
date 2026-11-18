import {describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';

describe('mobile Studio session replacements during take finalization',()=>{
  it('blocks blank, autosave, demo, ZIP backup, and ZIP restore while finalizing a take',async()=>{
    const source=await readFile('src/pages/Studio.jsx','utf8');
    for(const [start,end] of [
      ['const handleStartBlank = () => {','const handleLoadAutosave = () => {'],
      ['const handleLoadAutosave = () => {','const handleLoadDemo = async () => {'],
      ['const handleLoadDemo = async () => {','const handle'], // demo stops at next handler or block
      ['const handleSaveSessionToDevice = async () => {','const sessionImportRef = useRef(null);'],
      ['const handleSessionImport = async (event) => {','studioRestoreInFlightRef.current = true;'],
    ]){
      const from=source.indexOf(start);
      expect(from).toBeGreaterThan(0);
      const until=source.indexOf(end,from+start.length);
      expect(until).toBeGreaterThan(from);
      const guard=source.slice(from,until);
      expect(guard).toContain('microphoneStartupRef.current.pending');
      expect(guard).toContain('recordingFinalizeInFlightRef.current');
      expect(guard).toContain('isRecording');
      expect(guard).toContain('return;');
    }
  });
  it('does not commit a new session before the recording callback is settled',async()=>{
    const source=await readFile('src/pages/Studio.jsx','utf8');
    const blank=source.slice(source.indexOf('const handleStartBlank = () => {'),source.indexOf('const handleLoadAutosave'));
    expect(blank.indexOf('recordingFinalizeInFlightRef.current')).toBeLessThan(blank.indexOf('historyEpochRef.current += 1'));
    const restored=source.slice(source.indexOf('const handleSessionImport = async (event) => {'),source.indexOf('studioRestoreInFlightRef.current = true;',source.indexOf('const handleSessionImport')));
    expect(restored.indexOf('recordingFinalizeInFlightRef.current')).toBeGreaterThan(0);
  });
});
