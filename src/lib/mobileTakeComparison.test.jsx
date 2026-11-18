// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { applyStudioRecordedTake } from './studioRecordingTake';
import { relatedMobileTakes } from './mobileTakeComparison';
import MobileTakeReview from '../components/studio/MobileTakeReview';
afterEach(cleanup);
const original={id:10,name:'Lead',type:'audio',audioUrl:'blob:original',armed:true,startTime:0,duration:10};
const unrelated={id:13,name:'Adlib',type:'audio',audioUrl:'blob:adlib',armed:false};

describe('safe mobile A/B vocal-take comparison',()=>{
 it('keeps original bytes and tags only the new recording family',()=>{
  const result=applyStudioRecordedTake([original,unrelated],{
   audioUrl:'blob:second',waveform:[.2,.3],startTime:0,duration:10,nextId:14,
   captureQuality:{status:'good'},
  });
  expect(result).toHaveLength(3);
  expect(result[0].audioUrl).toBe('blob:original');
  expect(result[0].takeGroupId).toBe('10');
  expect(result[2].audioUrl).toBe('blob:second');
  expect(result[2].takeGroupId).toBe('10');
  expect(result[1].takeGroupId).toBeUndefined();
  expect(relatedMobileTakes(result,result[2]).map(t=>t.id)).toEqual([10,14]);
  expect(original.takeGroupId).toBeUndefined();
 });
 it('allows a third performance without merging unrelated backing tracks',()=>{
  const second=applyStudioRecordedTake([original,unrelated],{
   audioUrl:'blob:second',waveform:[],startTime:0,duration:10,nextId:14,
  });
  const third=applyStudioRecordedTake(second.map(t=>({...t,armed:t.id===14})),{
   audioUrl:'blob:third',waveform:[],startTime:0,duration:10,nextId:15,
  });
  expect(relatedMobileTakes(third,third[2]).map(t=>t.id)).toEqual([10,14,15]);
  expect(relatedMobileTakes(third,unrelated).map(t=>t.id)).toEqual([13]);
 });
 it('switches individual preview source and does not play two takes together',()=>{
  const takes=[{id:10,name:'Take 1',audioUrl:'blob:original'},
   {id:14,name:'Take 2',audioUrl:'blob:second'}];
  const onChooseTake=vi.fn(),onRetake=vi.fn();
  const track={...original};
  const view=render(<MobileTakeReview track={track} comparisonTakes={takes}
   onChooseTake={onChooseTake} onRetake={onRetake} onSaveForPC={vi.fn()}/>);
  expect(screen.getAllByRole('audio')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:/Listen to take 2/i}));
  expect(onChooseTake).toHaveBeenCalledWith(14);
  view.rerender(<MobileTakeReview track={{...original,id:14,audioUrl:'blob:second'}}
   comparisonTakes={takes} onChooseTake={onChooseTake} onRetake={onRetake} onSaveForPC={vi.fn()}/>);
  expect(screen.getByLabelText('Playback selected Studio take').getAttribute('src')).toBe('blob:second');
  expect(screen.getAllByRole('audio')).toHaveLength(1);
 });
});
