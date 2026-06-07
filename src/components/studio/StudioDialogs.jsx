import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

export default function StudioDialogs({
  creatingTrack, setCreatingTrack, newTrackName, setNewTrackName, newTrackType, setNewTrackType, handleCreateTrackConfirm,
  renamingTrack, setRenamingTrack, setTracksWithHistory,
  pendingTimeSignature, setPendingTimeSignature, setTimeSignature,
  pendingSongKey, setPendingSongKey, setSongKey
}) {
  return (
    <>
      <Dialog open={creatingTrack} onOpenChange={setCreatingTrack}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Track</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Track Name</label>
              <Input value={newTrackName} onChange={(e) => setNewTrackName(e.target.value)} onFocus={(e) => setTimeout(() => e.target.select(), 0)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTrackConfirm(); }} autoFocus />
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Track Type</label>
              <Select value={newTrackType} onValueChange={setNewTrackType}>
                <SelectTrigger><SelectValue placeholder="Select track type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="audio">Audio Track</SelectItem>
                  <SelectItem value="midi">MIDI Track</SelectItem>
                  <SelectItem value="instrument">Software Instrument</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newTrackType === 'midi' || newTrackType === 'instrument') && (<><div className="space-y-2"><label className="text-sm font-medium">Instrument / Plugin</label><Select defaultValue="default"><SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger><SelectContent><SelectItem value="default">Default Synth</SelectItem><SelectItem value="piano">Grand Piano</SelectItem><SelectItem value="drums">Drum Machine</SelectItem><SelectItem value="bass">Sub Bass</SelectItem><SelectItem value="external">External MIDI</SelectItem></SelectContent></Select></div><div className="space-y-2"><label className="text-sm font-medium">MIDI Channel</label><Select defaultValue="1"><SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="1">Channel 1</SelectItem><SelectItem value="2">Channel 2</SelectItem><SelectItem value="3">Channel 3</SelectItem><SelectItem value="4">Channel 4</SelectItem></SelectContent></Select></div></>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingTrack(false)}>Cancel</Button>
            <Button onClick={handleCreateTrackConfirm}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renamingTrack} onOpenChange={(open) => !open && setRenamingTrack(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Track</DialogTitle></DialogHeader>
          <Input value={newTrackName} onChange={(e) => setNewTrackName(e.target.value)} onFocus={(e) => setTimeout(() => e.target.select(), 0)} onKeyDown={(e) => { if (e.key === 'Enter') { if (newTrackName.trim()) { setTracksWithHistory(prev => prev.map(t => t.id === renamingTrack.id ? { ...t, name: newTrackName.trim() } : t)); } setRenamingTrack(null); } }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingTrack(null)}>Cancel</Button>
            <Button onClick={() => { if (newTrackName.trim()) { setTracksWithHistory(prev => prev.map(t => t.id === renamingTrack.id ? { ...t, name: newTrackName.trim() } : t)); } setRenamingTrack(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pendingTimeSignature} onOpenChange={(open) => !open && setPendingTimeSignature(null)}><DialogContent><DialogHeader><DialogTitle>Change Time Signature</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Are you sure you want to change the time signature to {pendingTimeSignature}? This will affect the grid and metronome.</p><DialogFooter><Button variant="outline" onClick={() => setPendingTimeSignature(null)}>Cancel</Button><Button onClick={() => { setTimeSignature(pendingTimeSignature); setPendingTimeSignature(null); toast.success("Time signature updated"); }}>Confirm</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!pendingSongKey} onOpenChange={(open) => !open && setPendingSongKey(null)}><DialogContent><DialogHeader><DialogTitle>Change Project Key</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Are you sure you want to change the project key to {pendingSongKey}? Auto-tune and pitch tools will adapt to this key.</p><DialogFooter><Button variant="outline" onClick={() => setPendingSongKey(null)}>Cancel</Button><Button onClick={() => { setSongKey(pendingSongKey); setPendingSongKey(null); toast.success("Project key updated"); }}>Confirm</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}