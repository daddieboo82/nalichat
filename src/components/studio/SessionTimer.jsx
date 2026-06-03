import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function format(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * A recording session timer artists can use to track time spent on takes.
 * Start/pause/reset with a prominent live readout while running.
 */
export default function SessionTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const reset = () => {
    setRunning(false);
    setSeconds(0);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-1.5 border transition-colors",
        running
          ? "bg-destructive/10 border-destructive/30"
          : "bg-secondary/50 border-border"
      )}
    >
      {running ? (
        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <span
        className={cn(
          "font-mono font-semibold tabular-nums text-sm tracking-wider",
          running ? "text-destructive" : "text-foreground"
        )}
      >
        {format(seconds)}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setRunning((r) => !r)}
          title={running ? "Pause" : "Start"}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          title="Reset"
          disabled={seconds === 0 && !running}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}