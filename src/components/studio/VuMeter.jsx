import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Real-time VU meter that reads actual audio levels from an HTMLAudioElement.
 * Pro Tools-style peak metering with green/yellow/red zones.
 */
export default function VuMeter({ audioRef, isPlaying, muted, volume, orientation = 'vertical', className }) {
  const [level, setLevel] = useState(0);
  const peakRef = useRef(0);
  const rafRef = useRef(null);
  const analyserRef = useRef(null);
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!isPlaying || !audioRef?.current || muted) {
      setLevel(0);
      return;
    }

    // Set up Web Audio analyser on the actual playing audio element
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume();

      if (!sourceRef.current) {
        sourceRef.current = ctxRef.current.createMediaElementSource(audioRef.current);
        const analyser = ctxRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        sourceRef.current.connect(analyser);
        analyser.connect(ctxRef.current.destination);
        analyserRef.current = analyser;
      }
    } catch {
      // Source already connected — reuse existing
    }

    const data = new Uint8Array(analyserRef.current?.frequencyBinCount || 128);

    const tick = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const scaled = Math.min(1, rms * 3 * (volume / 100));
        setLevel(scaled);
        if (scaled > peakRef.current) peakRef.current = scaled;
        else peakRef.current = Math.max(0, peakRef.current - 0.005);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, muted, volume, audioRef]);

  useEffect(() => () => {
    if (ctxRef.current) ctxRef.current.close();
  }, []);

  const pct = Math.round(level * 100);
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full border border-white/5 bg-black/60 shadow-inner',
        isVertical ? 'w-2 h-full' : 'h-2 w-full',
        className
      )}
    >
      <div
        className={cn(
          'absolute transition-all duration-75',
          isVertical ? 'bottom-0 left-0 right-0' : 'left-0 top-0 bottom-0',
          pct > 85 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' :
          pct > 60 ? 'bg-yellow-400' : 'bg-green-500'
        )}
        style={isVertical ? { height: `${pct}%` } : { width: `${pct}%` }}
      />
      {/* Peak hold marker */}
      {peakRef.current > 0.05 && (
        <div
          className={cn('absolute bg-white/60', isVertical ? 'left-0 right-0 h-0.5' : 'top-0 bottom-0 w-0.5')}
          style={isVertical ? { bottom: `${Math.round(peakRef.current * 100)}%` } : { left: `${Math.round(peakRef.current * 100)}%` }}
        />
      )}
    </div>
  );
}