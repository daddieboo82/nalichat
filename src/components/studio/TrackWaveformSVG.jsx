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

const EMPTY_WAVEFORM = Object.freeze([]);
// Crop to the original source time range without rescaling the peak bins.
// Use a small local SVG coordinate range even for very long source files.
export function studioWaveformWindow(waveform, sourceStart = 0, visibleDuration, fullDuration) {
  const length = waveform?.length || 0;
  if (!length) return { first: 0, last: 0, left: 0, width: 10000 };
  if (!Number.isFinite(fullDuration) || fullDuration <= 0 ||
      !Number.isFinite(visibleDuration) || visibleDuration <= 0) {
    return { first: 0, last: length, left: 0, width: 10000 };
  }
  const start = Math.max(0, Math.min(fullDuration, Number.isFinite(sourceStart) ? sourceStart : 0));
  const end = Math.min(fullDuration, start + visibleDuration);
  const left = start / fullDuration * 10000;
  const width = visibleDuration / fullDuration * 10000;
  const first = Math.max(0, Math.min(length, Math.floor(start / fullDuration * length)));
  const last = Math.max(first, Math.min(length, Math.ceil(end / fullDuration * length)));
  return { first, last, left, width };
}


function TrackWaveformSVG({ track, cropToClip = false }) {
  const wf = track.waveform || EMPTY_WAVEFORM;
  const gradId = React.useId();
  const color = resolveColor(track?.color);
  const sourceStart = cropToClip ? track.clipStart || 0 : 0;
  const visibleDuration = cropToClip ? track.duration : undefined;
  const fullDuration = cropToClip ? track.fullDuration || track.duration : undefined;
  const {first, last, left, width} = studioWaveformWindow(wf, sourceStart, visibleDuration, fullDuration);

  const peakPath = React.useMemo(() => {
    if (!wf.length || last <= first) return '';
    const amplitude = value => Number.isFinite(value) ? Math.min(1, Math.abs(value)) * 49 : 0;
    // Each peak summarizes a time bin, not an instantaneous sample.
    // Span both edges of each bin to avoid shifting transients as zoom changes.
    const commands = [`M ${first / wf.length * 10000},50`];
    for (let i = first; i < last; i++) {
      const y = (50 - amplitude(wf[i])).toFixed(3);
      commands.push(`L ${(i / wf.length * 10000).toFixed(3)},${y}`, `L ${((i + 1) / wf.length * 10000).toFixed(3)},${y}`);
    }
    for (let i = last - 1; i >= first; i--) {
      const y = (50 + amplitude(wf[i])).toFixed(3);
      commands.push(`L ${((i + 1) / wf.length * 10000).toFixed(3)},${y}`, `L ${(i / wf.length * 10000).toFixed(3)},${y}`);
    }
    return commands.join(' ') + ' Z';
  }, [wf, first, last]);

  return (
    <svg
      className={cn("w-full h-full")}
      style={{ color }}
      preserveAspectRatio="none"
      viewBox={`${left} 0 ${width} 100`}
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
      <line x1={left} y1="50" x2={left + width} y2="50" stroke="#000000" strokeOpacity="0.5" strokeWidth="2" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" />
    </svg>
  );
}

// Geometry depends on peaks and the visible source bounds, not mixer state.
export default React.memo(TrackWaveformSVG, (previous, next) =>
  previous.track.waveform === next.track.waveform && previous.track.color === next.track.color &&
  previous.cropToClip === next.cropToClip && (!next.cropToClip || (
    previous.track.clipStart === next.track.clipStart && previous.track.duration === next.track.duration &&
    previous.track.fullDuration === next.track.fullDuration))
);
