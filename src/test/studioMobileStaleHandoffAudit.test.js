import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
describe('Studio PC handoff rejects stale cloud snapshots',()=>{
 it('refuses success when project changes during upload, while preserving the committed snapshot',async()=>{
  const src=await readFile('src/pages/Studio.jsx','utf8');
  const saveStart=src.indexOf('  const handleSave = async () => {');
  const saveEnd=src.indexOf('  const saveMobileForDesktop = async () => {',saveStart);
  const save=src.slice(saveStart,saveEnd);
  expect(save).toContain('const editsDuringSave = tracksRef.current !== tracks;');
  expect(save).toContain('lastSavedStudioProjectRef.current = targetProjectId;');
  const warning=save.indexOf('if (editsDuringSave) {\n        // The prior snapshot');
  expect(warning).toBeGreaterThan(save.indexOf('lastSavedStudioProjectRef.current = targetProjectId;'));
  expect(save.slice(warning,warning+500)).toContain('return false;');
  expect(save.slice(warning+500)).toContain('toast.success(');
 });
 it('does not generate or advertise a PC handoff link after a stale save',async()=>{
  const src=await readFile('src/pages/Studio.jsx','utf8');
  const fn=src.slice(src.indexOf('  const saveMobileForDesktop = async () => {'),src.indexOf('  const restoreMobileTake = async (record) => {'));
  expect(fn).toContain('const saved = await handleSave();');
  expect(fn).toContain('if (!saved) return;');
  expect(fn.indexOf('if (!saved) return;')).toBeLessThan(fn.indexOf('studioDesktopHandoffUrl(savedId)'));
  expect(fn.indexOf('if (!saved) return;')).toBeLessThan(fn.indexOf('setMobileDesktopHandoffUrl(link)'));
 });
});
