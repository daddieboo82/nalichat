import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileStudioTracks, { mobilePreviewWaveform } from './MobileStudioTracks';

const first = {id:1,name:'Lead Vocal',type:'audio',armed:false,muted:false,solo:false,volume:80,waveform:Array.from({length:2000},(_,i)=>Math.abs(Math.sin(i/20))),audioUrl:'blob:lead'};
const second = {id:2,name:'Backing Beat',type:'audio',armed:false,muted:false,solo:false,volume:70, waveform:[],audioUrl:'blob:beat'};
function renderTracks(overrides={}) {
  const props = {
    lanes: [{primary:first,clips:[first]}, {primary:second,clips:[second]}],
    selectedTrackIds:[1],
    onSelect:vi.fn(),onArm:vi.fn(),onMute:vi.fn(),onSolo:vi.fn(),onVolume:vi.fn(),
    onAdd:vi.fn(),onImport:vi.fn(),onReconstruct:vi.fn(),onMixer:vi.fn(),onPolish:vi.fn(),
    autoPolish:true, ...overrides,
  };
  return {props, ...render(<MobileStudioTracks {...props}/>)};
}

describe('Mobile NaliChat recording-first Studio', () => {
  it('provides simple capture, mixing and AI tools without a desktop DAW timeline', () => {
    const {props} = renderTracks();
    fireEvent.click(screen.getByRole('button',{name:/arm lead vocal for recording/i}));
    fireEvent.click(screen.getByRole('button',{name:/mute lead vocal/i}));
    fireEvent.click(screen.getByRole('button',{name:/solo lead vocal/i}));
    fireEvent.click(screen.getByRole('button',{name:/import audio/i}));
    fireEvent.click(screen.getByRole('button',{name:/ai vocal/i}));
    fireEvent.click(screen.getByRole('button',{name:/mixer/i}));
    expect(props.onArm).toHaveBeenCalledWith(1);
    expect(props.onMute).toHaveBeenCalledWith(1);
    expect(props.onSolo).toHaveBeenCalledWith(1);
    expect(props.onImport).toHaveBeenCalledOnce();
    expect(props.onReconstruct).toHaveBeenCalledOnce();
    expect(props.onMixer).toHaveBeenCalledOnce();
  });

  it('allows touch volume adjustments and clear selected-track feedback', () => {
    const {props} = renderTracks();
    fireEvent.change(screen.getByRole('slider',{name:/volume for lead vocal/i}),{target:{value:'45'}});
    expect(props.onVolume).toHaveBeenCalledWith(1,[45]);
    expect(screen.getByTestId('mobile-track-1').querySelector('[aria-pressed="true"]')).toBeTruthy();
  });

  it('protects view-only sessions and recordings in progress', () => {
    const {props} = renderTracks({readOnly:true});
    expect(screen.getByRole('button',{name:/add audio track/i}).disabled).toBe(true);
    expect(screen.getByRole('button',{name:/arm lead vocal/i}).disabled).toBe(true);
    expect(screen.getByRole('button',{name:/mute lead vocal/i}).disabled).toBe(true);
    expect(screen.getByRole('button',{name:/ai vocal/i}).disabled).toBe(true);
    expect(props.onArm).not.toHaveBeenCalled();
  });

  it('reduces waveform drawing overhead on phones', () => {
    expect(mobilePreviewWaveform(first.waveform).length).toBe(160);
    expect(mobilePreviewWaveform([.2,.5])).toEqual([.2,.5]);
  });

  it('shows a clear first recording step when no tracks exist', () => {
    renderTracks({lanes:[],selectedTrackIds:[]});
    expect(screen.getByText('Ready to record')).toBeTruthy();
    expect(screen.getByText(/add a track, tap arm/i)).toBeTruthy();
  });
});
