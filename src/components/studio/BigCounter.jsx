import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pro Tools-style Big Counter — a large, always-visible transport counter
 * that overlays the top of the edit window. Cycles through BARS|BEATS|TICKS,
 * MIN:SEC, and SAMPLES formats on click.
 */
export default function BigCounter({ currentTimeRef, isRecording, bpm, sampleRate, open, onToggle }) {
  const [format, setFormat] = useState('bars'); // bars | minsec | samples
  const [display, setDisplay] = useState('001|1|000');
  const rafRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const t = currentTimeRef.current || 0;
      if (format === 'bars') {
        const beatsPerBar = 4;
        const secondsPerBeat = 60 / (bpm || 120);
        const totalBeats = Math.floor(t / secondsPerBeat);
        const bar = Math.floor(totalBeats / beatsPerBar) + 1;
        const beat = (totalBeats % beatsPerBar) + 1;
        const tick = Math.floor((t % secondsPerBeat) / secondsPerBeat * 960);
        setDisplay(`${String(bar).padStart(3, '0')}|${beat}|${String(tick).padStart(3, '0')}`);
      } else if (format === 'minsec') {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 1000);
        setDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`);
      } else {
        const sr = parseInt(sampleRate?.replace(/[^\d]/g, '')) || 44100;
        const samples = Math.floor(t * sr);
        setDisplay(samples.toLocaleString());
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, format, bpm, sampleRate]);

  if (!open) return null;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2">
      <button
        onClick={() => setFormat(f => f === 'bars' ? 'minsec' : f === 'minsec' ? 'samples' : 'bars')}
        className={cn(
          "px-6 py-2 rounded-xl border shadow-2xl backdrop-blur-xl font-mono text-2xl sm:text-3xl font-bold tracking-wider transition-all hover:scale-105",
          isRecording
            ? "bg-red-500/20 border-red-500/50 text-red-400"
            : "bg-card/90 border-primary/30 text-primary"
        )}
        title="Click to cycle time format"
      >
        {display}
      </button>
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-lg bg-card/90 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        title="Close Big Counter"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}