import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Trash2, Settings2, Layers, History } from "lucide-react";
import { cn } from "@/lib/utils";
import TrackVersionHistory from "./TrackVersionHistory";

const trackTypeColors = {
  vocal: "bg-primary",
  instrument: "bg-accent",
  beat: "bg-chart-4",
  sample: "bg-chart-3",
  fx: "bg-chart-5",
  master: "bg-foreground",
};

export default function TrackStrip({ track, onUpdate, onDelete, audioRef: externalRef, isPlaying, masterVolume, inQueue, onToggleQueue, canEdit = true, currentUser }) {
  const [showPan, setShowPan] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  // Stable waveform bar heights — regenerated only when track id changes
  const waveformBars = useMemo(() => Array.from({ length: 60 }, () => Math.random() * 28 + 4), [track.id]);
  // externalRef may be a callback ref (function) or a ref object; normalise to an object
  const audioRef = useRef(null);
  const setAudioRef = useCallback((el) => {
    audioRef.current = el;
    if (typeof externalRef === "function") externalRef(el);
    else if (externalRef) externalRef.current = el;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = ((track.volume || 75) / 100) * ((masterVolume ?? 100) / 100);
    }
  }, [masterVolume, track.volume]);

  const toggleMute = () => canEdit && onUpdate({ muted: !track.muted });
  const toggleSolo = () => canEdit && onUpdate({ solo: !track.solo });

  return (
    <div className={cn(
      "bg-secondary/30 rounded-xl border border-border p-3 transition-all",
      track.muted && "opacity-40",
      track.solo && "border-accent ring-1 ring-accent/20"
    )}>
      {track.file_url && (
        <audio
          ref={setAudioRef}
          src={track.file_url}
          onTimeUpdate={() => {}}
        />
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", trackTypeColors[track.type] || "bg-muted")} />
        <span className="font-medium text-xs flex-1 truncate">{track.name}</span>
        <span className="text-[9px] text-muted-foreground uppercase">{track.type}</span>
      </div>

      {/* Waveform */}
      <div className="h-10 bg-secondary rounded-lg mb-2 flex items-center gap-px px-1.5 overflow-hidden">
        {waveformBars.map((h, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-full", track.muted ? "bg-muted-foreground/20" : trackTypeColors[track.type] || "bg-primary")}
            style={{ height: `${h}px`, opacity: track.muted ? 0.3 : 0.7 }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[11px]",
              track.muted ? "bg-destructive/20 text-destructive" : "bg-secondary hover:bg-secondary/80"
            )}
            title="Mute"
          >
            {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>

          <button
            onClick={toggleSolo}
            className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[11px] font-bold",
              track.solo ? "bg-accent/20 text-accent" : "bg-secondary hover:bg-secondary/80"
            )}
            title="Solo"
          >
            S
          </button>

          <div className="flex-1">
            <Slider
              value={[track.volume || 75]}
              max={100}
              step={1}
              onValueChange={([v]) => canEdit && onUpdate({ volume: v })}
              className="w-full"
              disabled={!canEdit}
            />
          </div>
          <span className="text-[9px] text-muted-foreground w-6 text-right">{track.volume || 75}%</span>

          <button
            onClick={() => setShowPan(!showPan)}
            className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              showPan ? "bg-primary/20 text-primary" : "bg-secondary hover:bg-secondary/80"
            )}
            title="Pan"
          >
            <Settings2 className="w-3 h-3" />
          </button>

          {onToggleQueue && (
            <button
              onClick={onToggleQueue}
              className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                inQueue ? "bg-primary/20 text-primary" : "bg-secondary hover:bg-secondary/80"
              )}
              title={inQueue ? "Remove from queue" : "Add to queue"}
            >
              <Layers className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => setShowVersionHistory(true)}
            className="w-7 h-7 rounded-lg bg-secondary hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
            title="Version history"
          >
            <History className="w-3 h-3" />
          </button>

          {canEdit && (
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-lg bg-secondary hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Pan Control */}
        {showPan && (
          <div className="px-1.5 py-1.5 bg-secondary/50 rounded-lg border border-border/50">
            <div className="text-[9px] text-muted-foreground mb-1">Pan: {track.pan || 0}</div>
            <Slider
              value={[track.pan || 0]}
              min={-100}
              max={100}
              step={1}
              onValueChange={([v]) => canEdit && onUpdate({ pan: v })}
              className="w-full"
              disabled={!canEdit}
            />
          </div>
        )}
      </div>

      <TrackVersionHistory
        track={track}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onRevert={(data) => onUpdate(data)}
        canEdit={canEdit}
        currentUser={currentUser}
      />
    </div>
  );
}