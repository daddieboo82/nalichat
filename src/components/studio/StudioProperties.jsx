import { cn } from "@/lib/utils";
import { Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudioProperties({ selectedTrack, onTrackDelete, onTrackUpdate }) {
  if (!selectedTrack) {
    return (
      <div className="w-80 flex flex-col border-l border-border bg-card/40 p-6">
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-4">
          <div className="w-12 h-12 rounded-lg border border-border/40 flex items-center justify-center text-muted-foreground/40">
            <Copy className="w-6 h-6" />
          </div>
          <p className="text-center text-xs font-mono">SELECT A TRACK</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col border-l border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 bg-gradient-to-r from-accent/5 via-transparent to-transparent">
        <h3 className="text-[11px] font-heading font-black uppercase tracking-widest text-foreground/90">Properties</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Track Name */}
        <div className="space-y-2">
          <label className="text-[9px] font-mono font-bold text-foreground/70 uppercase tracking-wider">Track Name</label>
          <input
            type="text"
            value={selectedTrack.name}
            onChange={(e) => onTrackUpdate(selectedTrack.id, { name: e.target.value })}
            className="w-full bg-secondary/40 border border-border rounded-sm px-3 py-2 text-xs font-medium text-foreground focus:border-primary/80 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>

        {/* Track Type */}
        <div className="space-y-2">
          <label className="text-[9px] font-mono font-bold text-foreground/70 uppercase tracking-wider">Type</label>
          <select
            value={selectedTrack.type || "vocal"}
            onChange={(e) => onTrackUpdate(selectedTrack.id, { type: e.target.value })}
            className="w-full bg-secondary/40 border border-border rounded-sm px-3 py-2 text-xs font-medium text-foreground focus:border-primary/80 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          >
            <option value="vocal">Vocal</option>
            <option value="instrument">Instrument</option>
            <option value="beat">Beat</option>
            <option value="sample">Sample</option>
            <option value="fx">FX</option>
            <option value="master">Master</option>
          </select>
        </div>

        {/* Duration */}
        {selectedTrack.duration && (
          <div className="space-y-2">
            <label className="text-[9px] font-mono font-bold text-foreground/70 uppercase tracking-wider">Duration</label>
            <div className="text-xs font-mono text-foreground/80 bg-secondary/30 border border-border rounded-sm px-3 py-2">
              {Math.floor(selectedTrack.duration / 60)}:{String(Math.floor(selectedTrack.duration % 60)).padStart(2, "0")}
            </div>
          </div>
        )}

        {/* Color */}
        <div className="space-y-2">
          <label className="text-[9px] font-mono font-bold text-foreground/70 uppercase tracking-wider">Waveform Color</label>
          <input
            type="color"
            value={selectedTrack.color || "#0088FF"}
            onChange={(e) => onTrackUpdate(selectedTrack.id, { color: e.target.value })}
            className="w-full h-8 rounded-sm border border-border cursor-pointer"
          />
        </div>

        {/* AI Suggestions */}
        {(selectedTrack.suggested_bpm || selectedTrack.suggested_genre) && (
          <div className="pt-4 border-t border-border/40 space-y-3">
            <h4 className="text-[9px] font-mono font-bold text-foreground/70 uppercase tracking-wider">AI Analysis</h4>
            
            {selectedTrack.suggested_bpm && (
              <div className="bg-primary/10 border border-primary/30 rounded-sm px-3 py-2">
                <div className="text-[8px] text-primary/70 font-mono uppercase">Suggested BPM</div>
                <div className="text-sm font-mono font-bold text-primary mt-1">{selectedTrack.suggested_bpm} BPM</div>
              </div>
            )}

            {selectedTrack.suggested_genre && (
              <div className="bg-accent/10 border border-accent/30 rounded-sm px-3 py-2">
                <div className="text-[8px] text-accent/70 font-mono uppercase">Suggested Genre</div>
                <div className="text-sm font-mono font-bold text-accent mt-1">{selectedTrack.suggested_genre}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/60 bg-secondary/20">
        <Button
          onClick={() => onTrackDelete(selectedTrack.id)}
          className="w-full h-8 rounded-sm bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-mono font-bold uppercase tracking-wider transition-colors"
        >
          <Trash2 className="w-3 h-3 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
}