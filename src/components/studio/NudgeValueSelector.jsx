import React from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { Ruler } from 'lucide-react';

const getNudgeValues = (bpm = 120, sampleRate = 44100) => {
  const safeBpm = Math.max(20, Number(bpm) || 120);
  const beat = 60 / safeBpm;
  const tick = beat / 960;
  return [
    { id: 'samples_1', label: '1 Sample', value: 1 / sampleRate },
    { id: 'samples_10', label: '10 Samples', value: 10 / sampleRate },
    { id: 'samples_100', label: '100 Samples', value: 100 / sampleRate },
    { id: 'ms_1', label: '1 ms', value: 0.001 },
    { id: 'ms_10', label: '10 ms', value: 0.01 },
    { id: 'ms_100', label: '100 ms', value: 0.1 },
    { id: 'tick_1', label: '1 Tick', value: tick },
    { id: 'tick_10', label: '10 Ticks', value: tick * 10 },
    { id: 'beat_1', label: '1 Beat', value: beat },
    { id: 'beat_1_16', label: '1/16 Beat', value: beat / 16 },
    { id: 'bar_1', label: '1 Bar', value: beat * 4 },
  ];
};

/**
 * Pro Tools-style Nudge Value Selector — configures the nudge amount
 * used by Shift+Arrow key nudging.
 */
export default function NudgeValueSelector({ nudgeValue, setNudgeValue, bpm = 120, sampleRate = 44100 }) {
  const nudgeValues = getNudgeValues(bpm, sampleRate);
  const current = nudgeValues.find(n => Math.abs(n.value - nudgeValue) < 0.0001);
  const label = current?.label || `${(nudgeValue * 1000).toFixed(1)}ms`;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
          <Ruler className="w-3 h-3" />
          Nudge: <span className="font-mono text-primary">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 bg-card border-border">
        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Nudge Value</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {nudgeValues.map(n => (
          <DropdownMenuItem
            key={n.id}
            onClick={() => setNudgeValue(n.value)}
            className={cn("cursor-pointer text-xs", Math.abs(n.value - nudgeValue) < 0.0001 && "bg-primary/10 text-primary")}
          >
            {n.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}