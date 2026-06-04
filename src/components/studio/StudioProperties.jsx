import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudioProperties({ selectedTrack, onTrackDelete, onTrackUpdate }) {
  if (!selectedTrack) {
    return (
      <div className="w-80 flex flex-col border-l border-border/60 bg-card/50 p-6">
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Select a track to view properties
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col border-l border-border/60 bg-card/50 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(240 10% 8%), hsl(240 8% 12%))" }}>
      {/* Properties Header */}
      <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-accent/10 to-transparent">
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-accent/80">Properties</h3>
      </div>

      {/* Track Info */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Track Details */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">Track Name</label>
            <input
              type="text"
              value={selectedTrack.name}
              onChange={(e) => onTrackUpdate(selectedTrack.id, { name: e.target.value })}
              className="w-full bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">Type</label>
            <select
              value={selectedTrack.type || "vocal"}
              onChange={(e) => onTrackUpdate(selectedTrack.id, { type: e.target.value })}
              className="w-full bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:border-primary/50 focus:outline-none transition-colors"
            >
              <option value="vocal">Vocal</option>
              <option value="instrument">Instrument</option>
              <option value="beat">Beat</option>
              <option value="sample">Sample</option>
              <option value="fx">FX</option>
              <option value="master">Master</option>
            </select>
          </div>

          {selectedTrack.duration && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">Duration</label>
              <div className="text-sm font-mono text-muted-foreground/80">
                {Math.floor(selectedTrack.duration / 60)}:{String(Math.floor(selectedTrack.duration % 60)).padStart(2, "0")}
              </div>
            </div>
          )}
        </div>

        {/* Advanced */}
        <div className="pt-4 border-t border-border/40 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Advanced</h4>
          
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-2">Waveform Color</label>
            <input
              type="color"
              value={selectedTrack.color || "#6D28D9"}
              onChange={(e) => onTrackUpdate(selectedTrack.id, { color: e.target.value })}
              className="w-full h-8 rounded-lg border border-border/40 cursor-pointer"
            />
          </div>

          {selectedTrack.suggested_bpm && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">Suggested BPM</label>
              <div className="text-sm font-mono text-primary/80">{selectedTrack.suggested_bpm}</div>
            </div>
          )}

          {selectedTrack.suggested_genre && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">Suggested Genre</label>
              <div className="text-sm text-muted-foreground/80">{selectedTrack.suggested_genre}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-border/40">
          <Button
            onClick={() => onTrackDelete(selectedTrack.id)}
            className="w-full h-8 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Delete Track
          </Button>
        </div>
      </div>
    </div>
  );
}