import React from 'react';

// Renders one segment's waveform path. The expensive path-string build (up to
// 8000 points) is memoized on [waveform, gain] only — trimming/fading a
// segment changes sourceStart/sourceEnd/duration every pointer-move, but
// never the waveform data or gain, so this keeps drags buttery-smooth
// instead of rebuilding the SVG path on every mouse-move frame.
const SegmentWaveformSVG = React.memo(function SegmentWaveformSVG({ waveform, gain, segId, sourceStart, sourceEnd }) {
  const peakPath = React.useMemo(() => {
    const wf = waveform || [];
    const wLen = wf.length - 1 || 1;
    const g = gain ?? 1;
    let path = `M 0,50 `;
    for (let i = 0; i <= wLen; i++) path += `L ${(i / wLen) * 10000},${50 - Math.max(0.001, wf[i]) * 48 * g} `;
    for (let i = wLen; i >= 0; i--) path += `L ${(i / wLen) * 10000},${50 + Math.max(0.001, wf[i]) * 48 * g} `;
    path += 'Z';
    return path;
  }, [waveform, gain]);

  const gradId = `wf-grad-${segId}`;
  const srcStart = sourceStart || 0;
  const srcEnd = sourceEnd ?? 1;
  const ratio = srcEnd - srcStart || 1;

  return (
    <div className="absolute inset-y-0 pointer-events-none" style={{ left: `-${(srcStart / ratio) * 100}%`, width: `${(1 / ratio) * 100}%` }}>
      <svg className="w-full h-full pt-5 pb-0 pointer-events-none" style={{ filter: 'drop-shadow(0px 0px 5px hsl(var(--primary) / 0.45))' }} preserveAspectRatio="none" viewBox="0 0 10000 100">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="35%" stopColor="currentColor" stopOpacity="0.75" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="65%" stopColor="currentColor" stopOpacity="0.75" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <g className="text-primary fill-primary">
          <path d={peakPath} fill={`url(#${gradId})`} shapeRendering="geometricPrecision" />
        </g>
        <line x1="0" y1="50" x2="10000" y2="50" stroke="#000000" strokeOpacity="0.5" strokeWidth="2" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" />
      </svg>
    </div>
  );
});

export default SegmentWaveformSVG;