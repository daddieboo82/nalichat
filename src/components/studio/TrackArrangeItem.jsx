import { cn } from "@/lib/utils";
import { Music } from "lucide-react";

export default function TrackArrangeItem({
  track,
  isSelected,
  duration,
}) {
  const trackDuration = track.duration || 30;
  const trackWidth = (trackDuration / duration) * 100;

  const trackColors = {
    vocal: "bg-primary/60",
    instrument: "bg-accent/60",
    beat: "bg-chart-2/60",
    sample: "bg-chart-3/60",
    fx: "bg-chart-4/60",
    master: "bg-green-500/60",
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-all cursor-pointer group",
        isSelected
          ? "border-primary/70 bg-primary/10"
          : "border-border/40 bg-secondary/20 hover:border-primary/50 hover:bg-secondary/30"
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Track Info */}
        <div className="w-48 shrink-0 flex items-center gap-2 min-w-0">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", trackColors[track.type] || trackColors.vocal)}>
            <Music className="w-4 h-4 text-black/70" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{track.name}</p>
            <p className="text-[10px] text-muted-foreground/70 capitalize">{track.type}</p>
          </div>
        </div>

        {/* Timeline Visual */}
        <div className="flex-1 bg-secondary/50 rounded-lg h-12 relative overflow-hidden border border-border/20">
          <div
            className={cn(
              "h-full rounded transition-all",
              trackColors[track.type] || trackColors.vocal
            )}
            style={{ width: `${Math.min(trackWidth, 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center px-2">
            <p className="text-[10px] text-black/60 font-mono font-semibold">
              {Math.round(trackDuration)}s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}