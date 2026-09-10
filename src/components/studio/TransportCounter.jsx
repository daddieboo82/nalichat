import { useState, useRef, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Pro Tools-style big transport counter with switchable time formats.
 * Click to cycle: Bars|Beats → Min:Sec → Samples → (back to Bars|Beats)
 * Pro Tools shows a large, prominent time display that engineers rely on for navigation.
 */
const FORMATS = ['bbt', 'minsec', 'samples'];
const FORMAT_LABELS = { bbt: 'Bars|Beats', minsec: 'Min:Sec', samples: 'Samples' };

export default function TransportCounter({ currentTimeRef, isRecording, bpm, sampleRate = 44100 }) {
  const [format, setFormat] = useState('bbt');
  const displayRef = useRef(null);

  // Parse sample rate string like "44.1 kHz" → 44100
  const sr = (() => {
    const m = String(sampleRate).match(/([\d.]+)/);
    return m ? Math.round(parseFloat(m[1]) * 1000) : 44100;
  })();

  const formatBBT = (seconds) => {
    seconds = Math.max(0, seconds || 0);
    const beatsPerBar = 4;
    const secondsPerBeat = 60 / (bpm || 120);
    const totalBeats = Math.floor(seconds / secondsPerBeat);
    const bar = Math.floor(totalBeats / beatsPerBar) + 1;
    const beat = (totalBeats % beatsPerBar) + 1;
    const ticks = Math.floor((seconds % secondsPerBeat) / secondsPerBeat * 960);
    return `${bar.toString().padStart(3, '0')}|${beat}|${ticks.toString().padStart(3, '0')}`;
  };

  const formatMinSec = (seconds) => {
    seconds = Math.max(0, seconds || 0);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatSamples = (seconds) => {
    seconds = Math.max(0, seconds || 0);
    const samples = Math.floor(seconds * sr);
    return samples.toLocaleString();
  };

  const formatTime = (seconds) => {
    switch (format) {
      case 'minsec': return formatMinSec(seconds);
      case 'samples': return formatSamples(seconds);
      default: return formatBBT(seconds);
    }
  };

  // RAF loop to update the display directly (bypass React for 60fps)
  useEffect(() => {
    let rafId;
    const update = () => {
      if (displayRef.current && currentTimeRef?.current !== undefined) {
        displayRef.current.textContent = formatTime(currentTimeRef.current);
      }
      rafId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(rafId);
  }, [format, bpm, sr]);

  const cycleFormat = () => {
    const idx = FORMATS.indexOf(format);
    setFormat(FORMATS[(idx + 1) % FORMATS.length]);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={cycleFormat}
            className="relative group flex flex-col items-center justify-center bg-[#0a0a0c] px-2 sm:px-4 py-1 rounded-lg border border-border hover:border-primary/50 transition-colors shrink-0 min-w-[120px] sm:min-w-[160px]"
            aria-label={`Time display — ${FORMAT_LABELS[format]}. Click to switch format.`}
          >
            <div className="flex items-center gap-1.5">
              <span
                ref={displayRef}
                className="font-mono text-base sm:text-2xl text-primary font-bold tracking-tight tabular-nums"
              >
                {formatBBT(0)}
              </span>
              {isRecording && (
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              )}
            </div>
            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold mt-0.5 group-hover:text-primary/80 transition-colors">
              {FORMAT_LABELS[format]} · click to switch
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {FORMAT_LABELS[format]} — click to cycle format
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}