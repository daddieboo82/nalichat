import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/responsive-select';
import { Activity, Zap, AlignHorizontalJustifyCenter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Pro Tools-style Beat Detective dialog.
 * Analyzes transients in the selected track's waveform data and offers
 * to quantize detected hit points to the nearest grid division.
 *
 * Props:
 *  - open / onOpenChange: dialog visibility
 *  - track: the selected track object (must have waveform + duration)
 *  - bpm, timeSignature, gridSize: session musical settings
 *  - onQuantize: callback(hits, gridSeconds) — parent applies the quantize
 */
export default function BeatDetectiveDialog({ open, onOpenChange, track, bpm, timeSignature, gridSize, onQuantize }) {
  const [sensitivity, setSensitivity] = useState(0.3);
  const [minSpacing, setMinSpacing] = useState(0.05); // seconds between hits
  const [gridDiv, setGridDiv] = useState('1/8'); // quantize grid
  const [analyzing, setAnalyzing] = useState(false);
  const [hits, setHits] = useState([]);

  const beatsPerBar = parseInt(timeSignature?.split('/')[0]) || 4;
  const secondsPerBeat = 60 / (bpm || 120);

  // Map grid division to seconds
  const gridSeconds = useMemo(() => {
    const [num, den] = gridDiv.split('/').map(Number);
    return secondsPerBeat * (4 / den) * num;
  }, [gridDiv, secondsPerBeat]);

  // Detect transients from waveform peak data
  const analyze = () => {
    if (!track?.waveform || track.waveform.length === 0) {
      toast.error("No waveform data to analyze");
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      const wf = track.waveform;
      const duration = track.fullDuration || track.duration || 40;
      const detected = [];
      const threshold = sensitivity;

      for (let i = 2; i < wf.length - 2; i++) {
        const v = wf[i];
        // A transient is a local peak above threshold where the value rises sharply
        if (v > threshold && v >= wf[i - 1] && v >= wf[i + 1] && v > (wf[i - 2] || 0) * 1.3) {
          const time = (i / wf.length) * duration + (track.startTime || 0);
          // Enforce minimum spacing between hits
          if (detected.length === 0 || time - detected[detected.length - 1] >= minSpacing) {
            detected.push(time);
          }
        }
      }
      setHits(detected);
      setAnalyzing(false);
      if (detected.length === 0) {
        toast.info("No transients detected — try lowering the sensitivity");
      } else {
        toast.success(`${detected.length} transients detected`);
      }
    }, 100);
  };

  // Snap each hit to the nearest grid division
  const handleQuantize = () => {
    if (hits.length === 0) return;
    const quantized = hits.map(t => Math.round(t / gridSeconds) * gridSeconds);
    onQuantize?.(quantized, gridSeconds);
    toast.success(`${hits.length} hits quantized to ${gridDiv}`);
    onOpenChange(false);
  };

  // Preview: show how many hits would move and by how much
  const previewMoves = useMemo(() => {
    if (hits.length === 0) return { total: 0, maxOffset: 0, avgOffset: 0 };
    let totalMoved = 0;
    let maxOff = 0;
    let sumOff = 0;
    for (const t of hits) {
      const snapped = Math.round(t / gridSeconds) * gridSeconds;
      const offset = Math.abs(snapped - t);
      if (offset > 0.001) totalMoved++;
      if (offset > maxOff) maxOff = offset;
      sumOff += offset;
    }
    return { total: totalMoved, maxOffset: maxOff, avgOffset: sumOff / hits.length };
  }, [hits, gridSeconds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Activity className="w-5 h-5 text-primary" />
            Beat Detective
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Track info */}
          <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
            Analyzing: <span className="font-semibold text-foreground">{track?.name || 'No track selected'}</span>
          </div>

          {/* Sensitivity slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-500" /> Transient Sensitivity</label>
              <span className="font-mono text-muted-foreground">{Math.round(sensitivity * 100)}%</span>
            </div>
            <Slider value={[sensitivity]} min={0.05} max={0.9} step={0.05} onValueChange={(v) => setSensitivity(v[0])} />
          </div>

          {/* Min spacing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium">Min Hit Spacing</label>
              <span className="font-mono text-muted-foreground">{minSpacing.toFixed(2)}s</span>
            </div>
            <Slider value={[minSpacing]} min={0.01} max={0.5} step={0.01} onValueChange={(v) => setMinSpacing(v[0])} />
          </div>

          {/* Quantize grid */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5"><AlignHorizontalJustifyCenter className="w-3.5 h-3.5 text-accent" /> Quantize Grid</label>
            <Select value={gridDiv} onValueChange={setGridDiv}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1/4">1/4 Note ({(secondsPerBeat).toFixed(3)}s)</SelectItem>
                <SelectItem value="1/8">1/8 Note ({(secondsPerBeat / 2).toFixed(3)}s)</SelectItem>
                <SelectItem value="1/16">1/16 Note ({(secondsPerBeat / 4).toFixed(3)}s)</SelectItem>
                <SelectItem value="1/32">1/32 Note ({(secondsPerBeat / 8).toFixed(3)}s)</SelectItem>
                <SelectItem value="1/12">1/12 Triplet ({(secondsPerBeat * 2 / 3).toFixed(3)}s)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Analysis results */}
          {hits.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-secondary/30 rounded-lg p-2">
                <div className="text-lg font-bold font-heading text-primary">{hits.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Hits Found</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2">
                <div className="text-lg font-bold font-heading text-yellow-500">{previewMoves.total}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Will Move</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2">
                <div className="text-lg font-bold font-heading text-accent">{(previewMoves.avgOffset * 1000).toFixed(1)}ms</div>
                <div className="text-[10px] text-muted-foreground uppercase">Avg Offset</div>
              </div>
            </div>
          )}

          {/* Hit timeline preview */}
          {hits.length > 0 && (
            <div className="relative h-12 bg-black/30 rounded-lg overflow-hidden border border-border/40">
              {hits.map((t, i) => {
                const duration = track?.fullDuration || track?.duration || 40;
                const x = (t / duration) * 100;
                const snapped = Math.round(t / gridSeconds) * gridSeconds;
                const offset = snapped - t;
                return (
                  <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${x}%` }}>
                    <div className="w-0.5 h-full bg-yellow-500/80" />
                    {Math.abs(offset) > 0.005 && (
                      <div className={cn("absolute top-0 w-0.5 h-full", offset > 0 ? "bg-accent/60 left-0" : "bg-accent/60 right-0")}
                        style={{ transform: `translateX(${offset * 20}px)` }} />
                    )}
                  </div>
                );
              })}
              {/* Grid lines */}
              {Array.from({ length: Math.ceil((track?.fullDuration || track?.duration || 40) / gridSeconds) + 1 }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 w-px bg-border/30" style={{ left: `${(i * gridSeconds / (track?.fullDuration || track?.duration || 40)) * 100}%` }} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={analyze} disabled={analyzing || !track?.waveform}>
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
            {hits.length > 0 ? 'Re-analyze' : 'Analyze'}
          </Button>
          <Button onClick={handleQuantize} disabled={hits.length === 0} className="bg-gradient-to-r from-primary to-accent">
            <AlignHorizontalJustifyCenter className="w-4 h-4 mr-2" />
            Quantize ({hits.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}