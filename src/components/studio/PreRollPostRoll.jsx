import React, { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

/**
 * Pro Tools-style Pre-roll / Post-roll controls.
 * Pre-roll: playback starts this many seconds before the record start point.
 * Post-roll: playback continues this many seconds after recording stops.
 */
export default function PreRollPostRoll({ preRoll, setPreRoll, postRoll, setPostRoll }) {
  const [activeField, setActiveField] = useState(null);

  const formatBars = (seconds) => {
    // Approximate bars at 120 BPM 4/4 — just a visual hint
    const bars = (seconds / 2).toFixed(1);
    return `${bars} bar${bars === '1.0' ? '' : 's'}`;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="hidden lg:flex items-center gap-1 bg-background/50 border border-border/50 rounded-lg p-1 shrink-0">
        {/* Pre-roll */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex flex-col items-center px-2 py-0.5 rounded cursor-pointer transition-colors",
              preRoll > 0 ? "bg-blue-500/15" : "hover:bg-secondary/50"
            )}>
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Pre</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPreRoll(Math.max(0, preRoll - 1))}
                  className="w-3 h-3 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]"
                >−</button>
                <input
                  type="number"
                  value={preRoll}
                  min={0}
                  max={60}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(60, parseInt(e.target.value) || 0));
                    setPreRoll(v);
                  }}
                  onFocus={() => setActiveField('pre')}
                  onBlur={() => setActiveField(null)}
                  className="w-6 bg-transparent text-center font-mono text-[10px] font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setPreRoll(Math.min(60, preRoll + 1))}
                  className="w-3 h-3 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]"
                >+</button>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Pre-roll: {preRoll}s — playback starts {preRoll}s before record point
            {preRoll > 0 && <div className="text-blue-400 mt-0.5">≈ {formatBars(preRoll)} at 120 BPM</div>}
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border/50" />

        {/* Post-roll */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex flex-col items-center px-2 py-0.5 rounded cursor-pointer transition-colors",
              postRoll > 0 ? "bg-blue-500/15" : "hover:bg-secondary/50"
            )}>
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Post</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPostRoll(Math.max(0, postRoll - 1))}
                  className="w-3 h-3 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]"
                >−</button>
                <input
                  type="number"
                  value={postRoll}
                  min={0}
                  max={60}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(60, parseInt(e.target.value) || 0));
                    setPostRoll(v);
                  }}
                  onFocus={() => setActiveField('post')}
                  onBlur={() => setActiveField(null)}
                  className="w-6 bg-transparent text-center font-mono text-[10px] font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setPostRoll(Math.min(60, postRoll + 1))}
                  className="w-3 h-3 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]"
                >+</button>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Post-roll: {postRoll}s — playback continues {postRoll}s after recording stops
            {postRoll > 0 && <div className="text-blue-400 mt-0.5">≈ {formatBars(postRoll)} at 120 BPM</div>}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}