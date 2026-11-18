// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import MobileTakeReview from './MobileTakeReview';
import {readFile} from 'node:fs/promises';
afterEach(cleanup);
const track={id:2,name:'Vocal Take 1',audioUrl:'blob:recorded-take',
 captureQuality:{status:'clipping',peakDb:-0.02,rmsDb:-10.7}};
describe('mobile recorded-take review',()=>{
 it('plays only the selected source and explains the capture-quality measurement',()=>{
  render(<MobileTakeReview track={track} onRetake={()=>{}} onSaveForPC={()=>{}}/>);
  const player=screen.getByLabelText('Playback selected Studio take');
  expect(player.getAttribute('src')).toBe('blob:recorded-take');
  expect(screen.getByText(/possible clipping/i)).toBeTruthy();
  expect(screen.getByText(/Peak -0.0 dBFS/i)).toBeTruthy();
  expect(screen.getByText(/still in this browser/i)).toBeTruthy();
 });
 it('offers separate non-destructive retake and explicit cloud-save actions',()=>{
  const onRetake=vi.fn(),onSaveForPC=vi.fn();
  render(<MobileTakeReview track={track} onRetake={onRetake} onSaveForPC={onSaveForPC}/>);
  fireEvent.click(screen.getByRole('button',{name:/prepare another take, keeping original/i}));
  fireEvent.click(screen.getByRole('button',{name:/save reviewed take for pc/i}));
  expect(onRetake).toHaveBeenCalledWith(track);
  expect(onSaveForPC).toHaveBeenCalledOnce();
 });
 it('prevents editing actions during active recording or view-only sessions',()=>{
  render(<MobileTakeReview track={track} onRetake={()=>{}} onSaveForPC={()=>{}} recording/>);
  expect(screen.getByRole('button',{name:/prepare another take/i}).disabled).toBe(true);
  expect(screen.getByRole('button',{name:/save reviewed take/i}).disabled).toBe(true);
 });
 it('shows a truthful fallback for takes without decoded quality data',()=>{
  render(<MobileTakeReview track={{id:1,name:'Import',file_url:'https://example.com/audio.wav'}} onRetake={()=>{}} onSaveForPC={()=>{}}/>);
  expect(screen.getByText(/automatic quality measurements are unavailable/i)).toBeTruthy();
 });
 it('never deletes the original audio or uploads merely by selecting review',async()=>{
  const source=await readFile('src/components/studio/MobileTakeReview.jsx','utf8');
  expect(source).not.toContain('secureUploadFile(');
  expect(source).not.toContain('revokeObjectURL(');
  const studio=await readFile('src/pages/Studio.jsx','utf8');
  expect(studio).toContain('const prepareMobileRetake = (track) =>');
  expect(studio).toContain('Original audio preserved.');
  expect(studio).toContain('onSaveForPC={saveMobileForDesktop}');
 });
});
