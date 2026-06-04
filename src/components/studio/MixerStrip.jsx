import { useState } from "react";
import { Volume2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const trackColors = {
  vocal: "from-primary to-pink-500",
  instrument: "from-accent to-cyan-500",
  beat: "from-chart-2 to-purple-500",
  sample: "from-chart-3 to-orange-500",
  fx: "from-chart-4 to-yellow-500",
  master: "from-green-500 to-emerald-500",
};

export default function MixerStrip({ track }) {
  const [volume, setVolume] = useState(track.volume || 75);
  const [pan, setPan] = useState(track.pan || 0);
  const [isMuted, setIsMuted] = useState(track.muted || false);

  const gradient = trackColors[track.type] || trackColors.vocal;

  return (
    <div
      className={cn(
        "w-24 bg-gradient-to-b from-secondary/60 to-secondary/20 border border-border/40 rounded-xl p-3 flex flex-col items-center justify-between min-h-96 transition-all hover:border-primary/60 hover:shadow-lg",
        isMuted && "opacity-40"
      )}
      style={!isMuted ? { boxShadow: `0 8px 24px ${gradient.includes("primary") ? "rgb(200, 100, 255, 0.15)" : "rgb(100, 200, 255, 0.15)"}` } : {}}
    >
      {/* Track Name & Icon */}
      <div className="text-center w-full">
        <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${gradient} mx-auto mb-2 flex items-center justify-center shadow-xl border border-white/20`}>
          <Volume2 className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs font-bold text-foreground truncate">{track.name}</p>
        <p className="text-[9px] text-muted-foreground/60 capitalize mt-0.5">{track.type}</p>
      </div>

      {/* Volume Fader */}
      <div className="flex flex-col items-center justify-center flex-1">
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-1 h-32 [appearance:slider-vertical] [writing-mode:bt-lr] accent-primary hover:accent-primary/80 transition-colors"
          style={{
            WebkitAppearance: "slider-vertical",
            writingMode: "bt-lr",
          }}
        />
      </div>

      {/* Pan Slider */}
      <div className="w-full flex flex-col items-center gap-1 py-2 border-t border-border/30">
        <input
          type="range"
          min="-100"
          max="100"
          value={pan}
          onChange={(e) => setPan(Number(e.target.value))}
          className="w-full h-1 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full"
        />
        <p className="text-[9px] text-muted-foreground/60 font-mono">{pan}</p>
      </div>

      {/* Volume Label & Mute */}
      <div className="w-full space-y-2 border-t border-border/30 pt-2">
        <p className="text-xs font-mono font-bold text-primary text-center">{volume}dB</p>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={cn(
            "w-full py-1.5 rounded-lg transition-all flex items-center justify-center text-[10px] font-bold uppercase tracking-widest",
            isMuted
              ? "bg-destructive/40 text-destructive border border-destructive/50 shadow-lg shadow-destructive/20"
              : "bg-accent/30 text-accent border border-accent/40 hover:bg-accent/40 shadow-lg shadow-accent/20"
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}