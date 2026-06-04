import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, RotateCcw, FolderArchive, X, CheckSquare, Loader2, ZoomIn, ZoomOut, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import TrackStrip from "./TrackStrip";
import Timeline from "./Timeline";
import BounceDialog from "./BounceDialog";
import StemQueue from "./StemQueue";
import { downloadFilesAsZip } from "@/lib/downloadZip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export default function MultiTrackEditor({ tracks, selectedProject, onTrackUpdate, onTrackDelete, projectTitle, canEdit = true, currentUser }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [queue, setQueue] = useState([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [zipping, setZipping] = useState(false);

  const queueIds = new Set(queue.map(t => t.id));
  const toggleQueue = (track) =>
    setQueue(prev => prev.some(t => t.id === track.id)
      ? prev.filter(t => t.id !== track.id)
      : [...prev, track]);
  const removeFromQueue = (id) => setQueue(prev => prev.filter(t => t.id !== id));
  const audioContextRef = useRef(null);
  const playbackRef = useRef(null);

  const audioElements = useRef({});

  useEffect(() => {
    return () => {
      Object.values(audioElements.current).forEach(el => el?.pause());
    };
  }, []);

  const handlePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      Object.values(audioElements.current).forEach((el, idx) => {
        if (el && !tracks[idx]?.muted) {
          el.currentTime = currentTime;
          el.play();
        }
      });
    } else {
      setIsPlaying(false);
      Object.values(audioElements.current).forEach(el => el?.pause());
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    Object.values(audioElements.current).forEach(el => {
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    });
  };

  const toggleTrackSelect = (id) =>
    setSelectedTrackIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const clearTrackSelection = () => setSelectedTrackIds([]);

  const handleDownloadTracksZip = async () => {
    const selected = tracks.filter(t => selectedTrackIds.includes(t.id));
    if (!selected.length) return;
    setZipping(true);
    await downloadFilesAsZip(selected, "session-assets.zip");
    setZipping(false);
    clearTrackSelection();
  };

  const handleTimelineClick = (time) => {
    setCurrentTime(time);
    Object.values(audioElements.current).forEach(el => {
      if (el) el.currentTime = time;
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: "hsl(240 10% 3%)" }}>
      {/* Transport Controls */}
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3 flex-wrap" style={{ background: "hsl(240 8% 7% / 0.9)" }}>
        {/* Play/Stop/Rewind */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleTimelineClick(0)}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all hover:scale-105 active:scale-95"
            title="Rewind"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handlePlay}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg",
              isPlaying
                ? "bg-destructive/20 text-destructive border border-destructive/30 shadow-destructive/20"
                : "bg-gradient-to-br from-primary to-pink-500 text-white shadow-primary/30 hover:opacity-90"
            )}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            onClick={handleStop}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all hover:scale-105 active:scale-95"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        {/* Time display */}
        <div className="font-mono text-sm text-primary/80 bg-primary/5 border border-primary/15 px-3 py-1 rounded-lg min-w-[70px] text-center tabular-nums font-semibold">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
        </div>

        {/* Master volume */}
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMasterVolume(v);
              Object.values(audioElements.current).forEach(el => {
                if (el) el.volume = (v / 100) * 0.75;
              });
            }}
            className="w-20 h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${masterVolume}%, hsl(var(--secondary)) ${masterVolume}%, hsl(var(--secondary)) 100%)`
            }}
          />
          <span className="text-[11px] text-muted-foreground/70 tabular-nums w-8">{masterVolume}%</span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-muted-foreground/70 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.2))}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stem Queue */}
        <div>
          <StemQueue
            queue={queue}
            open={queueOpen}
            onToggle={() => setQueueOpen(v => !v)}
            onRemove={removeFromQueue}
            onClear={() => setQueue([])}
          />
        </div>

        {/* Bounce Button — editors/owners only */}
        {canEdit && (
          <BounceDialog projectTitle={projectTitle || selectedProject?.title} project={selectedProject} tracks={tracks} />
        )}
      </div>

      {/* Selection toolbar */}
      {selectedTrackIds.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 bg-primary/8 flex items-center gap-3">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">{selectedTrackIds.length} track{selectedTrackIds.length > 1 ? "s" : ""} selected</span>
          <Button size="sm" className="rounded-lg bg-primary hover:bg-primary/90 h-7 text-xs ml-2 shadow-sm" onClick={handleDownloadTracksZip} disabled={zipping}>
            {zipping ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FolderArchive className="w-3 h-3 mr-1" />}
            Export ZIP
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg h-7 text-xs text-muted-foreground" onClick={clearTrackSelection}>
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Timeline & Tracks */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Timeline
          currentTime={currentTime}
          duration={duration}
          zoom={zoom}
          onClick={handleTimelineClick}
        />

        {/* Tracks Container */}
        <div className="flex-1 overflow-y-auto">
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 gap-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
                <Volume2 className="w-9 h-9 text-primary/40" />
              </div>
              <div className="text-center">
                <p className="font-heading font-semibold text-lg">No tracks loaded</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Upload audio files to start mixing</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 p-3">
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className={cn(
                    "rounded-xl border transition-all flex items-start gap-2",
                    selectedTrackIds.includes(track.id)
                      ? "border-primary/60 ring-1 ring-primary/20 bg-primary/5"
                      : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card/70"
                  )}
                  style={{ padding: "10px 12px" }}
                >
                  <Checkbox
                    checked={selectedTrackIds.includes(track.id)}
                    onCheckedChange={() => toggleTrackSelect(track.id)}
                    className="mt-3 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <TrackStrip
                      track={track}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      onUpdate={(data) => canEdit && onTrackUpdate(track.id, data)}
                      onDelete={() => canEdit && onTrackDelete(track.id)}
                      audioRef={(ref) => {
                        if (ref) audioElements.current[idx] = ref;
                      }}
                      masterVolume={masterVolume}
                      inQueue={queueIds.has(track.id)}
                      onToggleQueue={() => toggleQueue(track)}
                      canEdit={canEdit}
                      currentUser={currentUser}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}