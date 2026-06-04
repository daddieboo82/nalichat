import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StudioTransport({
  isPlaying,
  onPlayPause,
  onStop,
  currentTime,
  duration,
  projectBpm,
}) {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="h-16 border-t border-primary/10 bg-gradient-to-r from-secondary/40 via-secondary/20 to-background backdrop-blur-xl shadow-lg shadow-primary/5 px-8 py-3 flex items-center gap-6">
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayPause}
          className={cn(
            "w-11 h-11 rounded-lg flex items-center justify-center transition-all font-bold shadow-lg",
            isPlaying
              ? "bg-gradient-to-r from-destructive/30 to-destructive/20 text-destructive hover:shadow-lg hover:shadow-destructive/40 border border-destructive/40"
              : "bg-gradient-to-r from-primary/40 to-accent/20 text-primary hover:shadow-lg hover:shadow-primary/40 border border-primary/30"
          )}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <button
          onClick={onStop}
          className="w-11 h-11 rounded-lg flex items-center justify-center bg-secondary/40 text-muted-foreground hover:bg-secondary/60 transition-all border border-border/40 shadow-lg shadow-primary/5"
          title="Stop"
        >
          <Square className="w-5 h-5" />
        </button>

        <button
          onClick={onStop}
          className="w-11 h-11 rounded-lg flex items-center justify-center bg-secondary/40 text-muted-foreground hover:bg-secondary/60 transition-all border border-border/40 shadow-lg shadow-primary/5"
          title="Rewind to start"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Time Display */}
      <div className="flex items-center gap-2 bg-secondary/30 px-4 py-2 rounded-lg border border-border/30 shadow-lg shadow-primary/5">
        <div className="font-mono text-sm font-bold text-primary bg-secondary/50 px-3 py-1 rounded-lg min-w-[100px] text-center border border-border/30">
          {formatTime(currentTime)}
        </div>
        <span className="text-xs text-muted-foreground/60">/</span>
        <div className="font-mono text-xs text-muted-foreground bg-secondary/40 px-2 py-1 rounded border border-border/20 min-w-[80px]">
          {formatTime(duration)}
        </div>
      </div>

      {/* BPM Info */}
      {projectBpm && (
        <div className="ml-auto flex items-center gap-3 bg-secondary/30 px-4 py-2 rounded-lg border border-accent/30 shadow-lg shadow-accent/10">
          <span className="text-xs text-muted-foreground/70 uppercase font-semibold">BPM</span>
          <span className="text-sm font-bold text-accent font-mono bg-secondary/50 px-2 py-1 rounded border border-accent/30">{projectBpm}</span>
        </div>
      )}
    </div>
  );
}