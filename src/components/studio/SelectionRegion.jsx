import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Pro Tools-style selection region overlay — renders the highlighted area
 * between in/out points on the timeline. Also renders the in/out marker flags.
 *
 * @param {number} selectionStart - Start time in seconds (null = no selection)
 * @param {number} selectionEnd - End time in seconds
 * @param {number} zoom - Current zoom level
 * @param {number} height - Height of the overlay area (optional)
 */
export default function SelectionRegion({ selectionStart, selectionEnd, zoom, className }) {
  if (selectionStart === null || selectionEnd === null || selectionStart >= selectionEnd) return null;

  const left = selectionStart * 20 * zoom;
  const width = (selectionEnd - selectionStart) * 20 * zoom;

  return (
    <div
      className={cn("absolute top-0 bottom-0 z-15 pointer-events-none", className)}
      style={{ left: `${left}px`, width: `${width}px` }}
    >
      {/* Highlighted region */}
      <div className="absolute inset-0 bg-primary/15 border-x-2 border-primary/60" />

      {/* In-point flag */}
      <div className="absolute top-0 -translate-x-1/2 h-full w-[2px] bg-primary">
        <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[8px] font-bold px-1 py-0.5 rounded-b whitespace-nowrap shadow-md">
          IN
        </div>
      </div>

      {/* Out-point flag */}
      <div className="absolute top-0 right-0 translate-x-1/2 h-full w-[2px] bg-primary">
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] font-bold px-1 py-0.5 rounded-b whitespace-nowrap shadow-md">
          OUT
        </div>
      </div>
    </div>
  );
}