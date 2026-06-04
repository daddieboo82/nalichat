import { cn } from "@/lib/utils";
import { Volume2, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function StudioMixer({ tracks, onTrackUpdate, selectedTrack, onSelectTrack }) {
  return (
    <div className="w-72 flex flex-col border-r border-border/60 bg-card/50 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(240 10% 8%), hsl(240 8% 12%))" }}>
      {/* Mixer Header */}
      <div className="px-3 py-3 border-b border-border/40 bg-gradient-to-r from-primary/10 to-transparent">
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-primary/80">Mixer</h3>
      </div>

      {/* Master Fader */}
      <div className="px-3 py-3 border-b border-border/40 bg-secondary/20">
        <div className="text-[10px] font-semibold text-foreground/70 mb-2">MASTER</div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            defaultValue="100"
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: "linear-gradient(to right, hsl(240 6% 18%), hsl(265 80% 60%))"
            }}
          />
          <span className="text-[9px] font-mono font-bold text-primary w-8 text-right">100</span>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No tracks
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className={cn(
                "p-2.5 rounded-lg border transition-all cursor-pointer group",
                selectedTrack?.id === track.id
                  ? "border-primary/60 bg-primary/10 shadow-sm shadow-primary/20"
                  : "border-border/30 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/40"
              )}
            >
              {/* Track Type Badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                  track.type === "vocal" && "bg-pink-500/30 text-pink-300",
                  track.type === "instrument" && "bg-blue-500/30 text-blue-300",
                  track.type === "beat" && "bg-purple-500/30 text-purple-300",
                  track.type === "sample" && "bg-amber-500/30 text-amber-300",
                  track.type === "fx" && "bg-cyan-500/30 text-cyan-300",
                  track.type === "master" && "bg-primary/30 text-primary"
                )}>
                  {track.type}
                </div>
              </div>

              {/* Track Name */}
              <p className="text-xs font-semibold text-foreground truncate mb-2">{track.name}</p>

              {/* Volume Fader */}
              <div className="mb-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={track.volume || 75}
                  onChange={(e) => onTrackUpdate(track.id, { volume: Number(e.target.value) })}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, hsl(240 6% 18%), hsl(265 80% 60%) ${(track.volume || 75)}%, hsl(240 6% 20%) ${(track.volume || 75)}%)`
                  }}
                />
                <div className="text-[9px] text-muted-foreground/70 text-right mt-0.5 font-mono">
                  {Math.round(track.volume || 75)}
                </div>
              </div>

              {/* Pan */}
              <div className="mb-2.5">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={track.pan || 0}
                  onChange={(e) => onTrackUpdate(track.id, { pan: Number(e.target.value) })}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, hsl(175 70% 45%) 0%, hsl(175 70% 45%) ${Math.max(0, (track.pan || 0) + 100) / 2}%, hsl(240 6% 20%) ${Math.max(0, (track.pan || 0) + 100) / 2}%, hsl(240 6% 20%) 100%)`
                  }}
                />
                <div className="text-[9px] text-muted-foreground/70 text-center mt-0.5 font-mono">
                  {track.pan === 0 ? "C" : track.pan > 0 ? `R${track.pan}` : `L${Math.abs(track.pan)}`}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <Checkbox
                  checked={!track.muted}
                  onCheckedChange={(checked) => onTrackUpdate(track.id, { muted: !checked })}
                  className="w-4 h-4"
                />
                <span className="text-[9px] text-muted-foreground/70 font-semibold">On</span>
                
                <Checkbox
                  checked={track.solo}
                  onCheckedChange={(checked) => onTrackUpdate(track.id, { solo: checked })}
                  className="w-4 h-4 ml-auto"
                />
                <span className="text-[9px] text-muted-foreground/70 font-semibold">Solo</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}