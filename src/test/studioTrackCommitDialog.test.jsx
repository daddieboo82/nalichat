// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import TrackCommitDialog from '@/components/studio/TrackCommitDialog';
import {renderStudioTrackCommit} from '@/lib/studioTrackCommit';
import {toast} from 'sonner';
vi.mock('@/lib/studioTrackCommit',()=>({renderStudioTrackCommit:vi.fn()}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
vi.mock('@/components/ui/dialog',()=>({Dialog:({open,children})=>open?children:null,DialogContent:({children})=><div>{children}</div>,DialogHeader:({children})=><div>{children}</div>,DialogTitle:({children})=><h2>{children}</h2>,DialogFooter:({children})=><div>{children}</div>}));
const track={id:1,name:'Vocal',audioUrl:'blob:original'};
const result={blob:new Blob(['wav']),duration:1,startTime:3,waveform:[.2]};
let resolve,reject;
const start=()=>fireEvent.click(screen.getByRole('button',{name:'Commit Track'}));
describe('Track Commit async dialog',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('URL',{createObjectURL:vi.fn(()=> 'blob:new'),revokeObjectURL:vi.fn()});renderStudioTrackCommit.mockImplementation(()=>new Promise((a,b)=>{resolve=a;reject=b;}));});
 afterEach(()=>{cleanup();vi.unstubAllGlobals();});
 it('commits only the original clip and transfers the new URL',async()=>{const onCommit=vi.fn(()=>true);render(<TrackCommitDialog open track={track} onCommit={onCommit} onOpenChange={()=>{}}/>);start();await act(async()=>resolve(result));expect(onCommit).toHaveBeenCalledWith('blob:new',result,track);expect(URL.revokeObjectURL).not.toHaveBeenCalled();});
 it('cancels without allocating a URL when rendering finishes late',async()=>{const onCommit=vi.fn(),onOpenChange=vi.fn();render(<TrackCommitDialog open track={track} onCommit={onCommit} onOpenChange={onOpenChange}/>);start();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await act(async()=>resolve(result));expect(onOpenChange).toHaveBeenCalledWith(false);expect(onCommit).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();});
 it('discards a render if selected track changes',async()=>{const onCommit=vi.fn(),onOpenChange=vi.fn();const view=render(<TrackCommitDialog open track={track} onCommit={onCommit} onOpenChange={onOpenChange}/>);start();view.rerender(<TrackCommitDialog open track={{...track,id:2}} onCommit={onCommit} onOpenChange={onOpenChange}/>);await act(async()=>resolve(result));expect(onCommit).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();});
 it('releases the new URL if parent rejects the commit',async()=>{const onCommit=vi.fn(()=>false);render(<TrackCommitDialog open track={track} onCommit={onCommit} onOpenChange={()=>{}}/>);start();await act(async()=>resolve(result));expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:new');expect(toast.success).not.toHaveBeenCalled();});
 it('suppresses late failure notifications after cancellation',async()=>{render(<TrackCommitDialog open track={track} onCommit={()=>true} onOpenChange={()=>{}}/>);start();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await act(async()=>reject(Error('late failure')));expect(toast.error).not.toHaveBeenCalled();});
});
