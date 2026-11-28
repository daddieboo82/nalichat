import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Snowflake, Loader2, Check } from 'lucide-react';
import { renderStudioTrackCommit } from '@/lib/studioTrackCommit';
import { toast } from 'sonner';

/**
 * Pro Tools-style Track Commit / Freeze dialog.
 * Renders a track's current state (volume, pan, clip gain, mixer effects) into a
 * new WAV file and replaces the track with the committed audio — freeing
 * CPU from any real-time processing.
 *
 * Props:
 *  - open / onOpenChange: dialog visibility
 *  - track: the track to commit
 *  - onCommit: callback(newAudioUrl, result, originalTrack) — parent replaces track data
 */
export default function TrackCommitDialog({ open, onOpenChange, track, onCommit, spectralPitch=false }) {
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState(false);
  const closeTimerRef = useRef(null);
  const attemptRef = useRef(0);
  const latestRef = useRef({open,track,onCommit});
  latestRef.current = {open,track,onCommit};

  useEffect(() => () => {
    attemptRef.current += 1;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleCommit = async () => {
    if (!track?.audioUrl) {
      toast.error("This track has no audio to commit");
      return;
    }
    const attempt = ++attemptRef.current;
    const original = track;
    setCommitting(true);
    try {
      const result = await renderStudioTrackCommit(original, {spectralPitch});
      if (attemptRef.current !== attempt || !latestRef.current.open || latestRef.current.track !== original) return;
      if (!result) {
        toast.error("Nothing to commit — track is empty or muted");
        setCommitting(false);
        return;
      }
      const url = URL.createObjectURL(result.blob);
      if (latestRef.current.onCommit?.(url, result, original) !== true) {
        URL.revokeObjectURL(url);
        return;
      }
      setDone(true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setDone(false);
        onOpenChange(false);
      }, 800);
      toast.success("Track committed — processing rendered to audio");
    } catch (e) {
      if (attemptRef.current !== attempt || !latestRef.current.open || latestRef.current.track !== original) return;
      console.error("Commit failed", e);
      toast.error("Failed to commit track");
    } finally {
      if (attemptRef.current === attempt) setCommitting(false);
    }
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      attemptRef.current += 1;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      setCommitting(false); setDone(false);
    }
    if (nextOpen && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      setDone(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-studio-surface border-foreground/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Snowflake className="w-5 h-5 text-accent" />
            Commit Track
          </DialogTitle>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Committing renders this track's current settings — volume, pan, clip gain, and mixer effects — into a new audio file.
            This frees up CPU by removing the need for real-time processing.
          </p>
          <div className="bg-studio-raised/50 rounded-lg px-3 py-2 text-xs">
            <span className="text-muted-foreground">Track: </span>
            <span className="font-semibold text-foreground">{track?.name}</span>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-500/90">
            ⚠️ This replaces the track's audio with a rendered version. The original audio remains available through Undo.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCommit} disabled={committing || done} className="bg-gradient-to-r from-accent to-primary">
            {committing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : done ? <Check className="w-4 h-4 mr-2" /> : <Snowflake className="w-4 h-4 mr-2" />}
            {done ? 'Committed!' : committing ? 'Rendering...' : 'Commit Track'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}