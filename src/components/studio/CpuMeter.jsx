import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Cpu } from 'lucide-react';

/**
 * Pro Tools-style CPU/DSP usage meter for the status bar.
 * Measures actual main-thread load via frame timing (RAF intervals).
 * Uses a rolling average for smooth, accurate readings.
 */
export default function CpuMeter() {
  const [cpu, setCpu] = useState(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(null);
  const samplesRef = useRef([]);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    let firstFrame = true;
    const tick = (now) => {
      if (firstFrame) {
        firstFrame = false;
        lastFrameRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;

      // A 60fps frame is ~16.67ms. CPU% = how much of the frame budget is used.
      const load = Math.min(100, (delta / 16.67) * 100);
      samplesRef.current.push(load);
      // Keep last 60 samples (~1 second at 60fps)
      if (samplesRef.current.length > 60) samplesRef.current.shift();

      // Update display every ~500ms
      if (now - lastUpdateRef.current > 500 && samplesRef.current.length >= 10) {
        const avg = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length;
        setCpu(Math.round(avg));
        lastUpdateRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const color = cpu > 80 ? 'text-red-500' : cpu > 60 ? 'text-yellow-400' : 'text-green-500';
  const barColor = cpu > 80 ? 'bg-red-500' : cpu > 60 ? 'bg-yellow-400' : 'bg-green-500';

  return (
    <div className="flex items-center gap-1.5" title="CPU Usage (main thread load)">
      <Cpu className={cn('w-3 h-3', color)} />
      <div className="w-12 h-1.5 bg-black/40 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300 rounded-full', barColor)}
          style={{ width: `${Math.min(100, cpu)}%` }}
        />
      </div>
      <span className={cn('font-mono text-[10px] tabular-nums w-7 text-right', color)}>{cpu}%</span>
    </div>
  );
}