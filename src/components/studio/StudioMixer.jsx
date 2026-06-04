import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function StudioMixer({ tracks, onTrackUpdate, selectedTrack, onSelectTrack }) {
  return (
    <div className="w-80 flex flex-col border-r border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <h3 className="text-[11px] font-heading font-black uppercase tracking-widest text-foreground/90">Mixer</h3>
      </div>

      {/* Master Fader */}
      <div className="px-4 py-4 border-b border-border/60 bg-secondary/20 space-y-3">
        <div className="text-[9px] font-mono font-bold text-foreground/70 uppercase tracking-wider">MASTER OUT</div>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            defaultValue="100"
            className="w-full h-1 bg-border rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-sm [&::-moz-range-thumb]:cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(240 10% 14%), hsl(200 100% 50%) 100%)`
            }}
          />
          <div className="flex justify-between items-center">
            <div className="text-[9px] font-mono text-foreground/70">-∞</div>
            <div className="text-[9px] font-mono font-bold text-primary">0.0 dB</div>
            <div className="text-[9px] font-mono text-foreground/70">+12</div>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No tracks loaded
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track)}
              className={cn(
                "p-3 rounded-md border transition-all cursor-pointer group",
                selectedTrack?.id === track.id
                  ? "border-primary/80 bg-primary/15 shadow-lg shadow-primary/20"
                  : "border-border/40 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/50"
              )}
            >
              {/* Track Type */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-mono font-bold text-foreground/60 uppercase tracking-wider">
                  {track.type}
                </span>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  track.muted ? "bg-muted-foreground/40" : "bg-primary animate-pulse"
                )} />
              </div>

              {/* Name */}
              <p className="text-xs font-semibold text-foreground truncate mb-2.5">{track.name}</p>

              {/* Volume */}
              <div className="mb-2.5">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={track.volume || 75}
                  onChange={(e) => onTrackUpdate(track.id, { volume: Number(e.target.value) })}
                  className="w-full h-0.5 bg-border rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:h-2 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full"
                  style={{
                    background: `linear-gradient(to right, hsl(240 10% 14%), hsl(200 100% 50%) ${(track.volume || 75)}%, hsl(240 10% 14%) ${(track.volume || 75)}%)`
                  }}
                />
                <div className="text-[8px] font-mono text-foreground/60 mt-1">{Math.round(track.volume || 75)} db</div>
              </div>

              {/* Pan */}
              <div className="mb-2.5">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={track.pan || 0}
                  onChange={(e) => onTrackUpdate(track.id, { pan: Number(e.target.value) })}
                  className="w-full h-0.5 bg-border rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:h-2 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full"
                  style={{
                    background: `linear-gradient(to right, hsl(280 90% 55%), hsl(240 10% 14%) 50%, hsl(280 90% 55%))`
                  }}
                />
                <div className="text-[8px] font-mono text-foreground/60 text-center mt-1">
                  {track.pan === 0 ? "CENTER" : track.pan > 0 ? `R${track.pan}` : `L${Math.abs(track.pan)}`}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/30">
                <Checkbox
                  checked={!track.muted}
                  onCheckedChange={(checked) => onTrackUpdate(track.id, { muted: !checked })}
                  className="w-3 h-3"
                />
                <span className="text-[8px] text-foreground/60 font-mono uppercase">Mute</span>
                
                <Checkbox
                  checked={track.solo}
                  onCheckedChange={(checked) => onTrackUpdate(track.id, { solo: checked })}
                  className="w-3 h-3 ml-auto"
                />
                <span className="text-[8px] text-foreground/60 font-mono uppercase">Solo</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}