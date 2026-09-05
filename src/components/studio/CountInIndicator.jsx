import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pro Tools-style count-in overlay.
 * Shows a visual 1-bar count-in (1-2-3-4) before recording starts,
 * with audible metronome clicks if the metronome is enabled.
 * Pro Tools engineers rely on count-in to prepare for recording punches.
 */
export default function CountInIndicator({ active, beatsPerBar = 4, onComplete, audioCtxRef }) {
  const [beat, setBeat] = useState(0);
  const rafRef = useRef(null);
  const nextClickTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const oscRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setBeat(0);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const ctx = audioCtxRef?.current || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();

    const secondsPerBeat = 60 / 120; // default; overridden by caller via bpm
    nextClickTimeRef.current = ctx.currentTime + 0.1;
    currentBeatRef.current = 0;
    setBeat(0);

    const playClick = (time, accented) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = accented ? 1000 : 600;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(accented ? 0.3 : 0.15, time + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.05);
      } catch {}
    };

    const schedule = () => {
      const ahead = 0.1;
      while (nextClickTimeRef.current < ctx.currentTime + ahead) {
        const b = currentBeatRef.current;
        playClick(nextClickTimeRef.current, b % beatsPerBar === 0);
        setBeat(b + 1);
        currentBeatRef.current++;
        nextClickTimeRef.current += secondsPerBeat;

        if (currentBeatRef.current >= beatsPerBar) {
          // Count-in complete — fire callback slightly after the last click
          setTimeout(() => onComplete?.(), (nextClickTimeRef.current - ctx.currentTime) * 1000 + 50);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(schedule);
    };

    schedule();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, beatsPerBar, onComplete, audioCtxRef]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-6">
        <div className="text-sm font-heading font-bold text-muted-foreground uppercase tracking-widest">
          Counting In
        </div>
        <div className="text-8xl font-heading font-black text-primary tabular-nums drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]">
          {beat || 1}
        </div>
        <div className="flex gap-3">
          {Array.from({ length: beatsPerBar }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-full transition-all duration-100',
                i < beat ? 'bg-primary scale-110 shadow-[0_0_12px_hsl(var(--primary)/0.6)]' : 'bg-muted-foreground/30 scale-90'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}