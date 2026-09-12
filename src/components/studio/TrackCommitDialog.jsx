import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Snowflake, Loader2, Check } from 'lucide-react';
import { renderMixToWav } from '@/lib/audioProcessing';
import { toast } from 'sonner';

/**
 * Pro Tools-style Track Commit / Freeze dialog.
 * Renders a track's current state (volume, pan, clip gain, fades) into a
 * new WAV file and replaces the track with the committed audio — freeing
 * CPU from any real-time processing.
 *
 * Props:
 *  - open / onOpenChange: dialog visibility
 *  - track: the track to commit
 *  - onCommit: callback(newAudioUrl, duration) — parent replaces track data
 */
export default function TrackCommitDialog({ open, onOpenChange, track, onCommit }) {
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleCommit = async () => {
    if (!track?.audioUrl) {
      toast.error("This track has no audio to commit");
      return;
    }
    setCommitting(true);
    try {
      const blob = await renderMixToWav([track]);
      if (!blob) {
        toast.error("Nothing to commit — track is empty or muted");
        setCommitting(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const duration = track.duration || 40;
      onCommit?.(url, duration);
      setDone(true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setDone(false);
        onOpenChange(false);
      }, 800);
      toast.success("Track committed — processing rendered to audio");
    } catch (e) {
      console.error("Commit failed", e);
      toast.error("Failed to commit track");
    } finally {
      setCommitting(false);
    }
  };

  const handleOpenChange = (nextOpen) => {
    if (nextOpen && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      setDone(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Snowflake className="w-5 h-5 text-accent" />
            Commit Track
          </DialogTitle>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Committing renders this track's current settings — volume, pan, clip gain, and fades — into a new audio file.
            This frees up CPU by removing the need for real-time processing.
          </p>
          <div className="bg-secondary/30 rounded-lg px-3 py-2 text-xs">
            <span className="text-muted-foreground">Track: </span>
            <span className="font-semibold text-foreground">{track?.name}</span>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-500/90">
            ⚠️ This replaces the track's audio with a rendered version. The original audio URL will be discarded.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCommit} disabled={committing || done} className="bg-gradient-to-r from-accent to-primary">
            {committing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : done ? <Check className="w-4 h-4 mr-2" /> : <Snowflake className="w-4 h-4 mr-2" />}
            {done ? 'Committed!' : committing ? 'Rendering...' : 'Commit Track'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}