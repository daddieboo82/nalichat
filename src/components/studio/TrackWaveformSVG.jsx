import React from 'react';
import { cn } from '@/lib/utils';

// Maps track.color values (e.g. "bg-purple-500", "bg-primary") to real CSS colors.
// This is necessary because Tailwind purges dynamically-constructed class names
// (e.g. `text-${color}`), so the SVG colors would never apply.
const COLOR_MAP = {
  'bg-primary': 'hsl(var(--primary))',
  'bg-accent': 'hsl(var(--accent))',
  'bg-foreground': 'hsl(var(--foreground))',
  'bg-purple-500': '#a855f7',
  'bg-blue-500': '#3b82f6',
  'bg-green-500': '#22c55e',
  'bg-yellow-500': '#eab308',
  'bg-pink-500': '#ec4899',
  'bg-red-500': '#ef4444',
  'bg-indigo-500': '#6366f1',
  'bg-orange-500': '#f97316',
  'bg-teal-500': '#14b8a6',
  'bg-cyan-500': '#06b6d4',
  'bg-chart-3': 'hsl(var(--chart-3))',
  'bg-chart-4': 'hsl(var(--chart-4))',
  'bg-chart-5': 'hsl(var(--chart-5))',
};

function resolveColor(color) {
  if (!color) return 'hsl(var(--primary))';
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  // If it's already a CSS value (hex, hsl, etc.)
  if (color.startsWith('#') || color.startsWith('hsl') || color.startsWith('rgb')) return color;
  // Strip "bg-" prefix and try again
  const stripped = color.replace('bg-', '');
  if (COLOR_MAP[`bg-${stripped}`]) return COLOR_MAP[`bg-${stripped}`];
  return 'hsl(var(--primary))';
}

export default function TrackWaveformSVG({ track }) {
  const wf = track.waveform || [];
  const wLen = wf.length - 1 || 1;
  const gradId = `studio-wf-grad-${track.id}`;
  const color = resolveColor(track?.color);

  let peakPath = `M 0,50 `;
  for (let i = 0; i <= wLen; i++) peakPath += `L ${(i / wLen) * 10000},${50 - Math.max(0.001, wf[i]) * 49} `;
  for (let i = wLen; i >= 0; i--) peakPath += `L ${(i / wLen) * 10000},${50 + Math.max(0.001, wf[i]) * 49} `;
  peakPath += 'Z';

  return (
    <svg
      className={cn("w-full h-full")}
      style={{ color, filter: `drop-shadow(0px 0px 4px ${color})` }}
      preserveAspectRatio="none"
      viewBox="0 0 10000 100"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="35%" stopColor={color} stopOpacity="0.7" />
          <stop offset="50%" stopColor={color} stopOpacity="0.3" />
          <stop offset="65%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <g>
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