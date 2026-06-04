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
    <div className="h-16 border-t border-border/40 bg-secondary/20 backdrop-blur-sm px-4 py-3 flex items-center gap-4">
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayPause}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-all font-bold",
            isPlaying
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
              : "bg-primary/20 text-primary hover:bg-primary/30 shadow-lg shadow-primary/30"
          )}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <button
          onClick={onStop}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary/70 transition-all"
          title="Stop"
        >
          <Square className="w-5 h-5" />
        </button>

        <button
          onClick={onStop}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary/70 transition-all"
          title="Rewind to start"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Time Display */}
      <div className="flex items-center gap-2">
        <div className="font-mono text-sm font-bold text-primary bg-secondary/40 px-3 py-1.5 rounded-lg min-w-[100px] text-center">
          {formatTime(currentTime)}
        </div>
        <span className="text-xs text-muted-foreground">/</span>
        <div className="font-mono text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded min-w-[80px]">
          {formatTime(duration)}
        </div>
      </div>

      {/* BPM Info */}
      {projectBpm && (
        <div className="ml-auto flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-lg">
          <span className="text-xs text-muted-foreground">BPM:</span>
          <span className="text-sm font-bold text-foreground font-mono">{projectBpm}</span>
        </div>
      )}
    </div>
  );
}