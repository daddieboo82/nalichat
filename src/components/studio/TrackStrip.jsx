import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, Headphones, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const trackTypeColors = {
  vocal: "bg-primary",
  instrument: "bg-accent",
  beat: "bg-chart-4",
  sample: "bg-chart-3",
  fx: "bg-chart-5",
  master: "bg-foreground",
};

export default function TrackStrip({ track, onUpdate, onDelete }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const toggleMute = () => onUpdate({ muted: !track.muted });
  const toggleSolo = () => onUpdate({ solo: !track.solo });

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border p-4 transition-all",
      track.muted && "opacity-50",
      track.solo && "border-accent"
    )}>
      {track.file_url && <audio ref={audioRef} src={track.file_url} onEnded={() => setPlaying(false)} />}
      
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-3 h-3 rounded-full shrink-0", trackTypeColors[track.type] || "bg-muted")} />
        <span className="font-medium text-sm flex-1 truncate">{track.name}</span>
        <span className="text-[10px] text-muted-foreground uppercase">{track.type}</span>
      </div>

      {/* Waveform */}
      <div className="h-12 bg-secondary/50 rounded-lg mb-3 flex items-center gap-px px-2 overflow-hidden">
        {Array.from({ length: 80 }, (_, i) => (
          <div
            key={i}
            className={cn("w-0.5 rounded-full", track.muted ? "bg-muted-foreground/20" : trackTypeColors[track.type] || "bg-primary")}
            style={{ height: `${Math.random() * 32 + 8}px`, opacity: track.muted ? 0.3 : 0.6 }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={togglePlay} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors" disabled={!track.file_url}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        
        <button
          onClick={toggleMute}
          className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            track.muted ? "bg-destructive/20 text-destructive" : "bg-secondary hover:bg-secondary/80"
          )}
        >
          {track.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={toggleSolo}
          className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-xs font-bold",
            track.solo ? "bg-accent/20 text-accent" : "bg-secondary hover:bg-secondary/80"
          )}
        >
          <Headphones className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 px-2">
          <Slider
            value={[track.volume || 75]}
            max={100}
            step={1}
            onValueChange={([v]) => onUpdate({ volume: v })}
            className="w-full"
          />
        </div>
        <span className="text-[10px] text-muted-foreground w-8 text-right">{track.volume || 75}%</span>

        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-lg bg-secondary hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors ml-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}