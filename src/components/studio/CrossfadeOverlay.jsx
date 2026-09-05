import React from 'react';

/**
 * Pro Tools-style crossfade overlay.
 * Detects adjacent/overlapping clips on the same track and renders
 * a visual crossfade zone with a diamond-shaped fade indicator.
 *
 * @param {array} clips - All clips on a track (usually just the one track's clip)
 * @param {number} zoom - Current zoom level
 * @param {number} trackId - Track ID for keying
 */
export default function CrossfadeOverlay({ clips, zoom, trackId }) {
  if (!clips || clips.length < 2) return null;

  // Sort by start time
  const sorted = [...clips].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const fades = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const aEnd = (a.startTime || 0) + (a.duration || 0);
    const bStart = b.startTime || 0;

    // If clips overlap or are within 0.05s of each other, show a crossfade
    const overlap = aEnd - bStart;
    if (overlap >= -0.05) {
      const fadeStart = Math.max(a.startTime || 0, bStart);
      const fadeEnd = Math.min(aEnd, (b.startTime || 0) + (b.duration || 0));
      const fadeDuration = Math.max(0.1, fadeEnd - fadeStart);
      const fadeWidth = fadeDuration * 20 * zoom;
      const fadeLeft = fadeStart * 20 * zoom;

      fades.push(
        <div
          key={`xfade-${trackId}-${i}`}
          className="absolute top-0 bottom-0 pointer-events-none z-30"
          style={{ left: `${fadeLeft}px`, width: `${fadeWidth}px` }}
          title={`Crossfade: ${fadeDuration.toFixed(3)}s`}
        >
          {/* Diagonal crossfade lines */}
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Label */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white/60 bg-black/40 px-1 rounded whitespace-nowrap">
            ×
          </div>
        </div>
      );
    }
  }

  return fades.length > 0 ? <>{fades}</> : null;
}