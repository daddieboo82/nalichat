import React, { useEffect, useRef } from 'react';

// Surgical crosshair: follows the pointer over the waveform in real time and
// shows the exact time under the cursor with millisecond precision.
// Uses direct DOM updates (no re-renders) so tracking stays perfectly smooth.
export default function PrecisionCrosshair({ containerRef, duration, zoom }) {
  const lineRef = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fmt = (t) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const ms = Math.floor((t % 1) * 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };
    const move = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left + el.scrollLeft;
      const t = Math.max(0, Math.min(duration, (x / (rect.width * zoom)) * duration));
      if (lineRef.current) {
        lineRef.current.style.left = `${x}px`;
        lineRef.current.style.opacity = '1';
      }
      if (labelRef.current) labelRef.current.textContent = fmt(t);
    };
    const hide = () => { if (lineRef.current) lineRef.current.style.opacity = '0'; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', hide);
    el.addEventListener('pointerdown', hide);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', hide);
      el.removeEventListener('pointerdown', hide);
    };
  }, [containerRef, duration, zoom]);

  return (
    <div
      ref={lineRef}
      className="absolute top-6 bottom-0 w-px bg-white/40 z-20 pointer-events-none opacity-0"
      style={{ left: 0 }}
    >
      <div
        ref={labelRef}
        className="absolute top-1 left-1.5 bg-black/85 text-white/90 text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap border border-white/10 shadow-lg"
      />
    </div>
  );
}