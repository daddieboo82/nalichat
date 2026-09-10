import React, { useRef, useCallback } from 'react';

/**
 * Pro Tools-style volume automation lane.
 * Renders below the waveform when showAutomation is enabled.
 * Users click to add breakpoints and drag to move them.
 * The automation curve scales the track volume over time.
 *
 * @param {object} track - The track object with automationPoints array
 * @param {function} onPointsChange - (newPoints) => void
 * @param {function} onCommit - Called when drag ends (for undo history)
 * @param {number} zoom - Current zoom level
 * @param {number} trackDuration - Duration of the clip in seconds
 */
export default function AutomationLane({ track, onPointsChange, onCommit, zoom, trackDuration = 40 }) {
  const laneRef = useRef(null);
  // 'volume' (default) or 'pan' — toggled via the lane header
  const autoMode = track.automationMode || 'volume';
  const pointsKey = autoMode === 'pan' ? 'panAutomationPoints' : 'automationPoints';
  const points = track[pointsKey] || [];
  const clipStart = track.startTime || 0;
  const clipDuration = track.duration || trackDuration;
  const clipWidth = clipDuration * 20 * zoom;
  const baseValue = autoMode === 'pan' ? (track.pan ?? 50) : (track.volume ?? 75);
  const label = autoMode === 'pan' ? 'PAN AUTO' : 'VOL AUTO';
  const hint = autoMode === 'pan'
    ? 'Click to add a pan automation point (top=L, center=C, bottom=R)'
    : 'Click anywhere to add a volume automation point';

  // Convert a point {time, value} to pixel coordinates
  const timeToX = useCallback((time) => {
    return (time - clipStart) * 20 * zoom;
  }, [clipStart, zoom]);

  // Convert Y pixel to volume value (0-100, top=100, bottom=0)
  const yToValue = useCallback((clientY, laneHeight) => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    const y = clientY - rect.top;
    return Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
  }, []);

  const handleLaneClick = (e) => {
    if (e.target.closest('[data-automation-point]')) return; // Don't add when clicking existing point
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const time = clipStart + x / (20 * zoom);
    const value = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
    const newPoint = { time: Math.max(clipStart, Math.min(clipStart + clipDuration, time)), value };
    const sortedPoints = [...points, newPoint].sort((a, b) => a.time - b.time);
    onPointsChange(sortedPoints, autoMode);
    onCommit();
  };

  const handlePointDrag = (e, index) => {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPoint = points[index];

    const handleMove = (moveEvent) => {
      const rect = laneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const newTime = Math.max(clipStart, Math.min(clipStart + clipDuration, startPoint.time + deltaX / (20 * zoom)));
      const newValue = Math.max(0, Math.min(100, startPoint.value - (deltaY / rect.height) * 100));
      const newPoints = [...points];
      newPoints[index] = { time: newTime, value: newValue };
      newPoints.sort((a, b) => a.time - b.time);
      onPointsChange(newPoints, autoMode);
    };

    const handleUp = (upEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      onCommit();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handlePointDelete = (e, index) => {
    e.stopPropagation();
    // Right-click or double-click to delete
    const newPoints = points.filter((_, i) => i !== index);
    onPointsChange(newPoints, autoMode);
    onCommit();
  };

  // Build the SVG path for the automation curve
  const buildPath = () => {
    if (points.length === 0) {
      const y = 100 - baseValue;
      return `M 0 ${y}% L ${clipWidth} ${y}%`;
    }
    let path = `M 0 ${100 - (points[0].value)}%`;
    for (let i = 0; i < points.length; i++) {
      const x = timeToX(points[i].time);
      path += ` L ${x} ${100 - points[i].value}%`;
    }
    path += ` L ${clipWidth} ${100 - (points[points.length - 1].value)}%`;
    return path;
  };

  const toggleMode = (e) => {
    e.stopPropagation();
    const newMode = autoMode === 'volume' ? 'pan' : 'volume';
    onPointsChange([], newMode); // empty call just to trigger mode change via parent
  };

  return (
    <div
      ref={laneRef}
      onPointerDown={handleLaneClick}
      className="absolute bottom-0 left-0 right-0 h-16 border-t border-white/10 bg-black/40 cursor-crosshair group/auto"
      title="Click to add automation points • Drag to move • Right-click to delete"
    >
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-0 right-0 border-t border-white/10" />
        <div className="absolute top-1/2 left-0 right-0 border-t border-white/10" />
        <div className="absolute top-3/4 left-0 right-0 border-t border-white/10" />
      </div>

      {/* Label + mode toggle */}
      <button
        onClick={toggleMode}
        className="absolute top-1 left-2 text-[9px] font-mono text-primary/60 hover:text-primary pointer-events-auto z-20 bg-black/40 px-1.5 py-0.5 rounded transition-colors"
        title="Click to toggle between Volume and Pan automation"
      >
        {label} ⇄
      </button>

      {/* Pan center line */}
      {autoMode === 'pan' && (
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-white/15 pointer-events-none" />
      )}

      {/* Automation line (SVG) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <polyline
          points={points.length > 0
            ? points.map(p => `${timeToX(p.time)},${100 - p.value}%`).join(' ')
            : `0,${100 - baseValue}% ${clipWidth},${100 - baseValue}%`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* Fill below the line */}
        <polygon
          points={points.length > 0
            ? `0,100% ${points.map(p => `${timeToX(p.time)},${100 - p.value}%`).join(' ')} ${clipWidth},100%`
            : `0,100% 0,${100 - baseValue}% ${clipWidth},${100 - baseValue}% ${clipWidth},100%`}
          fill="hsl(var(--primary))"
          opacity="0.1"
        />
      </svg>

      {/* Automation points */}
      {points.map((point, index) => (
        <div
          key={index}
          data-automation-point
          onPointerDown={(e) => handlePointDrag(e, index)}
          onContextMenu={(e) => { e.preventDefault(); handlePointDelete(e, index); }}
          onDoubleClick={(e) => handlePointDelete(e, index)}
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 bg-primary border border-white rounded-full cursor-grab active:cursor-grabbing shadow-md hover:scale-125 transition-transform z-20"
          style={{
            left: `${timeToX(point.time)}px`,
            top: `${100 - point.value}%`,
          }}
          title={`Vol: ${point.value.toFixed(0)}% — drag to move, double-click to delete`}
        />
      ))}

      {/* Hint when empty */}
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-muted-foreground/40 italic">{hint}</span>
        </div>
      )}
    </div>
  );
}