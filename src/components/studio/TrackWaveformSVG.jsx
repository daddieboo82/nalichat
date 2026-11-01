import React from 'react';
import { cn } from '@/lib/utils';
import { getTrackClipRegions } from '@/lib/studioClipRegions';

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
  const waveform = Array.isArray(track.waveform) ? track.waveform : [];
  const sampleCount = Math.max(1, waveform.length - 1);
  const gradId = `studio-wf-grad-${track.id}`;
  const color = resolveColor(track?.color);
  const regions = getTrackClipRegions(track);
  const sourceDuration = Math.max(
    0.001,
    Number(track.fullDuration) || Number(track.clipStart || 0) + Number(track.duration || 40)
  );
  const timelineDuration = Math.max(0.001, Number(track.duration) || 40);
  const trackStart = Number(track.startTime) || 0;

  const regionPaths = regions.map(region => {
    const sourceStart = Math.max(0, Math.min(sourceDuration, region.sourceStart));
    const sourceEnd = Math.max(sourceStart, Math.min(sourceDuration, region.sourceEnd));
    const firstSample = Math.max(0, Math.min(sampleCount, Math.floor(sourceStart / sourceDuration * sampleCount)));
    const lastSample = Math.max(firstSample + 1, Math.min(sampleCount, Math.ceil(sourceEnd / sourceDuration * sampleCount)));
    const timelineX = Math.max(0, (region.timelineStart - trackStart) / timelineDuration * 10000);
    const timelineWidth = Math.max(0, (sourceEnd - sourceStart) / timelineDuration * 10000);
    const points = [];
    for (let sample = firstSample; sample <= lastSample; sample++) {
      const ratio = (sample - firstSample) / Math.max(1, lastSample - firstSample);
      const x = timelineX + ratio * timelineWidth;
      const amplitude = Math.max(0.001, Number(waveform[sample]) || 0.001);
      points.push([x, amplitude]);
    }
    if (points.length === 0) return { id: region.id, path: '' };
    let path = `M ${points[0][0]},50 `;
    points.forEach(([x, amplitude]) => { path += `L ${x},${50 - amplitude * 49} `; });
    [...points].reverse().forEach(([x, amplitude]) => { path += `L ${x},${50 + amplitude * 49} `; });
    path += 'Z';
    return { id: region.id, path };
  });

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
        {regionPaths.map(region => region.path ? (
          <path
            key={region.id}
            d={region.path}
            fill={`url(#${gradId})`}
            shapeRendering="geometricPrecision"
          />
        ) : null)}
      </g>
      <line x1="0" y1="50" x2="10000" y2="50" stroke="#000000" strokeOpacity="0.5" strokeWidth="2" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" />
    </svg>
  );
}
