import React from 'react';
import { cn } from '@/lib/utils';

export default function TrackWaveformSVG({ track }) {
  const wf = track.waveform || [];
  const wLen = wf.length - 1 || 1;
  const gradId = `studio-wf-grad-${track.id}`;

  let peakPath = `M 0,50 `;
  for (let i = 0; i <= wLen; i++) peakPath += `L ${(i/wLen)*10000},${50 - Math.max(0.001, wf[i])*49} `;
  for (let i = wLen; i >= 0; i--) peakPath += `L ${(i/wLen)*10000},${50 + Math.max(0.001, wf[i])*49} `;
  peakPath += 'Z';

  const colorBase = track?.color ? track.color.replace('bg-', '') : 'primary';
  const baseFill = `text-${colorBase} fill-current`;

  return (
    <svg className={cn("w-full h-full", baseFill)} style={{ filter: `drop-shadow(0px 0px 4px currentColor)` }} preserveAspectRatio="none" viewBox="0 0 10000 100">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="35%" stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="65%" stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <g className={baseFill}>
        <path 
          d={peakPath} 
          fill={`url(#${gradId})`} 
          shapeRendering="geometricPrecision"
        />
      </g>
      <line x1="0" y1="50" x2="10000" y2="50" stroke="#000000" strokeOpacity="0.5" strokeWidth="2" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" />
    </svg>
  );
}