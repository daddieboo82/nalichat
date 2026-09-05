import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Pro Tools-style Clip Gain Line — a draggable horizontal line on each clip
 * that adjusts clip gain independently of track volume.
 * Range: -12 dB to +12 dB. Default: 0 dB (center).
 * The line position maps: top = +12dB, bottom = -12dB, center = 0dB.
 */
export default function ClipGainLine({ clipGain = 0, onChange, onCommit, activeTool }) {
  // Only show the gain line when the Smart or Trim tool is active (Pro Tools shows it contextually)
  const visible = activeTool === 'smart' || activeTool === 'trim';

  if (!visible) return null;

  // Map gain (-12 to +12) to Y position (0% to 100%)
  // +12 dB = top (0%), 0 dB = center (50%), -12 dB = bottom (100%)
  const yPercent = ((12 - clipGain) / 24) * 100;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    const target = e.currentTarget;
    const container = target.parentElement;
    const rect = container.getBoundingClientRect();
    target.setPointerCapture(e.pointerId);

    const startY = e.clientY;
    const startGain = clipGain;

    const handleMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      // 1px ≈ 0.5 dB (24 dB range over ~48px of drag)
      const newGain = Math.max(-12, Math.min(12, Math.round((startGain - deltaY * 0.25) * 10) / 10));
      target.style.top = `${((12 - newGain) / 24) * 100}%`;
      // Update the gain badge
      const badge = container.querySelector('[data-gain-badge]');
      if (badge) {
        badge.textContent = `${newGain > 0 ? '+' : ''}${newGain.toFixed(1)} dB`;
        badge.style.opacity = '1';
      }
      target.dataset.newGain = newGain;
    };

    const handleUp = (upEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      const newGainStr = target.dataset.newGain;
      if (newGainStr !== undefined) {
        const newGain = parseFloat(newGainStr);
        onChange(newGain);
        if (onCommit) onCommit();
        delete target.dataset.newGain;
      }
      // Fade out the badge after a delay
      const badge = container.querySelector('[data-gain-badge]');
      if (badge) {
        setTimeout(() => { if (badge) badge.style.opacity = '0'; }, 1500);
      }
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  return (
    <>
      {/* The gain line — a horizontal dashed line across the clip */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute left-0 right-0 z-30 cursor-ns-resize group/gain"
        style={{ top: `${yPercent}%`, height: '0px' }}
      >
        <div className="absolute left-0 right-0 border-t border-dashed border-yellow-400/60 group-hover/gain:border-yellow-400 transition-colors" />
        {/* Drag handle dots at left and right edges */}
        <div className="absolute -left-1 -top-1 w-2 h-2 bg-yellow-400 rounded-full shadow-sm opacity-0 group-hover/gain:opacity-100 transition-opacity" />
        <div className="absolute -right-1 -top-1 w-2 h-2 bg-yellow-400 rounded-full shadow-sm opacity-0 group-hover/gain:opacity-100 transition-opacity" />
      </div>
      {/* Gain value badge — shows current gain, fades when not interacting */}
      <div
        data-gain-badge
        className={cn(
          "absolute top-1 right-2 z-30 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold pointer-events-none transition-opacity",
          clipGain !== 0 ? "bg-yellow-400/20 text-yellow-400 opacity-100" : "bg-black/40 text-yellow-400/80 opacity-0"
        )}
      >
        {clipGain > 0 ? '+' : ''}{clipGain.toFixed(1)} dB
      </div>
    </>
  );
}