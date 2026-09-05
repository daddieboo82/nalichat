import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from '@/lib/utils';

const FADE_PRESETS = [
  { id: 'equal_power', label: 'Equal Power', desc: 'Smooth crossfade, constant power', curve: 'pow' },
  { id: 'equal_gain', label: 'Equal Gain', desc: 'Linear fade, constant level', curve: 'linear' },
  { id: 'fast_in', label: 'Fast In', desc: 'Quick rise at the start', curve: 'exp_in' },
  { id: 'fast_out', label: 'Fast Out', desc: 'Quick fall at the end', curve: 'exp_out' },
  { id: 's_curve', label: 'S-Curve', desc: 'Smooth S-shaped transition', curve: 's' },
];

/**
 * Pro Tools-style Fade Presets — apply preset fade curves to selected clips.
 * Renders a visual preview of the fade curve.
 */
export default function FadePresetsDialog({ open, onOpenChange, tracks, selectedTrackIds, onApply }) {
  const [preset, setPreset] = useState('equal_power');
  const [fadeInAmount, setFadeInAmount] = useState(5); // percent of clip
  const [fadeOutAmount, setFadeOutAmount] = useState(5);

  const renderCurve = (curve, width = 120, height = 40) => {
    const points = [];
    for (let i = 0; i <= width; i++) {
      const x = i / width;
      let y;
      switch (curve) {
        case 'linear': y = x; break;
        case 'pow': y = Math.sqrt(x); break;
        case 'exp_in': y = Math.pow(x, 3); break;
        case 'exp_out': y = Math.pow(x, 1/3); break;
        case 's': y = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; break;
        default: y = x;
      }
      points.push(`${i},${height - y * height}`);
    }
    return (
      <svg width={width} height={height} className="inline-block">
        <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
        <line x1="0" y1={height} x2={width} y2="0" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" strokeDasharray="2,2" />
      </svg>
    );
  };

  const handleApply = () => {
    const fadeIn = fadeInAmount / 100;
    const fadeOut = fadeOutAmount / 100;
    onApply(fadeIn, fadeOut, preset);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Fade Presets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground">
            Applying to {selectedTrackIds.length} clip{selectedTrackIds.length !== 1 ? 's' : ''}
          </div>

          {/* Preset grid */}
          <div className="grid grid-cols-1 gap-2">
            {FADE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                  preset === p.id
                    ? "bg-primary/20 border-primary"
                    : "bg-secondary/30 border-border hover:bg-secondary/50"
                )}
              >
                {renderCurve(p.curve)}
                <div className="flex-1">
                  <div className={cn("text-sm font-semibold", preset === p.id ? "text-primary" : "text-foreground")}>{p.label}</div>
                  <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Fade amounts */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span>Fade In</span><span className="font-mono text-primary">{fadeInAmount}%</span></div>
              <Slider value={[fadeInAmount]} min={0} max={50} step={1} onValueChange={v => setFadeInAmount(v[0])} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span>Fade Out</span><span className="font-mono text-primary">{fadeOutAmount}%</span></div>
              <Slider value={[fadeOutAmount]} min={0} max={50} step={1} onValueChange={v => setFadeOutAmount(v[0])} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply}>Apply Fades</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}