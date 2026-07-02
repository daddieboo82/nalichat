import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

export function Knob({ value, min = 0, max = 100, onChange, label, unit = "", formatValue }) {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const change = (deltaY / 150) * range; // 150px drag = full range
    const newVal = Math.max(min, Math.min(max, startVal.current + change));
    onChange(newVal);
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.target.releasePointerCapture(e.pointerId);
  };

  const percent = (value - min) / (max - min);
  const angle = -135 + percent * 270; // -135 to 135 degrees

  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#2d2d30] border-2 border-[#151516] relative cursor-ns-resize shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center group touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* LED Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" strokeDasharray="264" strokeDashoffset={264 * (1 - 270/360)} />
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary" strokeDasharray="264" strokeDashoffset={264 * (1 - (percent * 270)/360)} />
        </svg>
        <div 
          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#3f3f46] shadow-md flex items-start justify-center pt-1"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="w-1 h-2 bg-primary rounded-full group-hover:bg-primary/80 transition-colors" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest">{label}</div>
        <div className="text-[10px] md:text-xs font-mono text-white/80">{formatValue ? formatValue(value) : `${Math.round(value)}${unit}`}</div>
      </div>
    </div>
  );
}