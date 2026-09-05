import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Pro Tools-style metronome / click track.
 * Generates click sounds programmatically using Web Audio API — no external files.
 * Accented beat on beat 1, lighter clicks on other beats.
 */
export default function Metronome({ isPlaying, bpm, timeSignature, enabled, onToggle }) {
  const audioCtxRef = useRef(null);
  const nextClickTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const rafRef = useRef(null);

  const beatsPerBar = parseInt(timeSignature?.split('/')[0]) || 4;

  const playClick = useCallback((time, accented) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
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
  }, []);

  const ensureContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Scheduler loop — runs ahead of time for sample-accurate clicks
  useEffect(() => {
    if (!isPlaying || !enabled) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const ctx = ensureContext();
    const secondsPerBeat = 60 / bpm;
    nextClickTimeRef.current = ctx.currentTime;
    currentBeatRef.current = 0;

    const schedule = () => {
      const ahead = 0.1; // schedule 100ms ahead
      while (nextClickTimeRef.current < ctx.currentTime + ahead) {
        const beat = currentBeatRef.current;
        playClick(nextClickTimeRef.current, beat % beatsPerBar === 0);
        nextClickTimeRef.current += secondsPerBeat;
        currentBeatRef.current++;
      }
      rafRef.current = requestAnimationFrame(schedule);
    };

    schedule();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, enabled, bpm, beatsPerBar, playClick, ensureContext]);

  useEffect(() => () => {
    if (audioCtxRef.current) audioCtxRef.current.close();
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(!enabled)}
            className={cn(
              'gap-2 rounded-lg transition-colors h-8',
              enabled ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={enabled ? 'Disable Click' : 'Enable Click'}
            aria-label={enabled ? 'Disable Click' : 'Enable Click'}
            aria-pressed={enabled}
          >
            {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline text-xs">Click</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs flex items-center gap-1">
          {enabled ? 'Disable Metronome' : 'Enable Metronome'}
          <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">7</kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}