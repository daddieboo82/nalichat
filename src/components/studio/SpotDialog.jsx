import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';

/**
 * Pro Tools-style Spot dialog — lets the user type an exact timecode position
 * for the selected clip. Supports Bars|Beats and Min:Sec formats.
 *
 * @param {boolean} open
 * @param {function} onOpenChange
 * @param {object} clip - The clip being spotted (track object)
 * @param {function} onSpot - (timeInSeconds) => void
 * @param {number} bpm - Session BPM for Bars|Beats conversion
 * @param {string} timeSignature - e.g. "4/4"
 */
export default function SpotDialog({ open, onOpenChange, clip, onSpot, bpm = 120, timeSignature = '4/4' }) {
  const [format, setFormat] = useState('minsec'); // 'minsec' or 'barsbeats'
  const [reference, setReference] = useState('start'); // start, sync, or end
  const [minSec, setMinSec] = useState('0:00.000');
  const [barsBeats, setBarsBeats] = useState('1|1|000');

  useEffect(() => {
    if (open && clip) {
      const startTime = clip.startTime || 0;
      // Min:Sec format
      const mins = Math.floor(startTime / 60);
      const secs = Math.floor(startTime % 60);
      const ms = Math.floor((startTime % 1) * 1000);
      setMinSec(`${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`);

      // Bars|Beats format
      const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;
      const secondsPerBeat = 60 / bpm;
      const totalBeats = Math.floor(startTime / secondsPerBeat);
      const bar = Math.floor(totalBeats / beatsPerBar) + 1;
      const beat = (totalBeats % beatsPerBar) + 1;
      const ticks = Math.floor(((startTime % secondsPerBeat) / secondsPerBeat) * 1000);
      setBarsBeats(`${bar}|${beat}|${ticks.toString().padStart(3, '0')}`);
    }
  }, [open, clip, bpm, timeSignature]);

  const parseMinSec = (str) => {
    const match = str.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    const mins = parseInt(match[1]);
    const secs = parseInt(match[2]);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0').substring(0, 3)) : 0;
    return mins * 60 + secs + ms / 1000;
  };

  const parseBarsBeats = (str) => {
    const match = str.match(/^(\d+)\|(\d+)\|(\d+)$/);
    if (!match) return null;
    const bar = parseInt(match[1]);
    const beat = parseInt(match[2]);
    const ticks = parseInt(match[3].padEnd(3, '0').substring(0, 3));
    const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;
    const secondsPerBeat = 60 / bpm;
    return ((bar - 1) * beatsPerBar + (beat - 1)) * secondsPerBeat + (ticks / 1000) * secondsPerBeat;
  };

  const handleSpot = () => {
    let timeInSeconds = null;
    if (format === 'minsec') {
      timeInSeconds = parseMinSec(minSec);
    } else {
      timeInSeconds = parseBarsBeats(barsBeats);
    }
    if (timeInSeconds === null || isNaN(timeInSeconds) || timeInSeconds < 0) {
      return;
    }
    const duration = clip?.duration || 0;
    const syncOffset = Math.max(0, Math.min(duration, clip?.syncPointOffset || 0));
    const offset = reference === 'end' ? duration : reference === 'sync' ? syncOffset : 0;
    onSpot(Math.max(0, timeInSeconds - offset), reference);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Spot Clip — {clip?.name || 'Selected Clip'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 mb-3">
          <Button variant={reference === 'start' ? 'default' : 'outline'} size="sm" onClick={() => setReference('start')} className="flex-1">Start</Button>
          <Button variant={reference === 'sync' ? 'default' : 'outline'} size="sm" onClick={() => setReference('sync')} className="flex-1">Sync</Button>
          <Button variant={reference === 'end' ? 'default' : 'outline'} size="sm" onClick={() => setReference('end')} className="flex-1">End</Button>
        </div>

        <div className="flex gap-1 mb-4">
          <Button
            variant={format === 'minsec' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('minsec')}
            className="flex-1"
          >
            Min:Sec
          </Button>
          <Button
            variant={format === 'barsbeats' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('barsbeats')}
            className="flex-1"
          >
            Bars|Beats
          </Button>
        </div>

        <div className="space-y-2">
          {format === 'minsec' ? (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{reference[0].toUpperCase() + reference.slice(1)} Position (M:SS.mmm)</label>
              <Input
                value={minSec}
                onChange={(e) => setMinSec(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSpot(); }}
                placeholder="0:00.000"
                className="font-mono text-lg text-center"
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{reference[0].toUpperCase() + reference.slice(1)} Position (Bar|Beat|Tick)</label>
              <Input
                value={barsBeats}
                onChange={(e) => setBarsBeats(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSpot(); }}
                placeholder="1|1|000"
                className="font-mono text-lg text-center"
                autoFocus
              />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            {format === 'minsec'
              ? 'Format: Minutes:Seconds.Milliseconds — e.g. 1:30.500'
              : `Format: Bar|Beat|Tick — e.g. 5|3|480 (at ${bpm} BPM ${timeSignature})`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSpot}>
            <MapPin className="w-4 h-4 mr-1" /> Spot to Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}