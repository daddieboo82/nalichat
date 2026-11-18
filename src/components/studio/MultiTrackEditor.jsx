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
import { toast } from "sonner";
import { sessionTrackLocalTime, sessionTrackShouldPlay, sessionTrackStart, sessionTrackEnd } from "@/lib/sessionTrackTiming";

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
  const pendingPlayRef = useRef(new WeakSet());

  const audioElements = useRef({});

  useEffect(() => {
    setDuration(Math.max(0, ...tracks.map(track => sessionTrackEnd(track, audioElements.current[track.id]?.duration))));
  }, [tracks]);

  useEffect(() => {
    return () => {
      playbackRef.current = null;
      Object.values(audioElements.current).forEach(el => el?.pause());
    };
  }, []);

  // One session clock owns the timeline. Individual HTML media timeupdate
  // events must not reset the shared transport or erase another track offset.
  useEffect(() => {
    if (!isPlaying || !playbackRef.current) return;
    const timer = window.setInterval(() => {
      const clock = playbackRef.current;
      if (!clock) return;
      const sessionTime = clock.from + (performance.now() - clock.startedAt) / 1000;
      setCurrentTime(sessionTime);
      const hasSolo = tracks.some(t => t.solo && !t.muted);
      for (const track of tracks) {
        const element = audioElements.current[track.id];
        if (!element) continue;
        const allowed = !track.muted && (!hasSolo || track.solo);
        const active = allowed && sessionTrackShouldPlay(track, sessionTime, element.duration);
        if (!active) {
          if (!element.paused) element.pause();
          continue;
        }
        const local = sessionTrackLocalTime(track, sessionTime);
        if (Math.abs(element.currentTime - local) > 0.15 && Number.isFinite(local)) {
          try { element.currentTime = local; } catch { /* decoding in progress */ }
        }
        if (element.paused && !pendingPlayRef.current.has(element)) {
          pendingPlayRef.current.add(element);
          Promise.resolve(element.play()).catch(error => console.warn("Shared track playback could not start", error))
            .finally(() => pendingPlayRef.current.delete(element));
        }
      }
      const end = Math.max(0, ...tracks.map(t => sessionTrackEnd(t, audioElements.current[t.id]?.duration)));
      if (end > 0 && sessionTime >= end) {
        playbackRef.current = null;
        setIsPlaying(false);
        Object.values(audioElements.current).forEach(element => element?.pause());
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [isPlaying, tracks]);

  const handlePlay = async () => {
    if (!isPlaying) {
      const attempts = [];
      const hasSoloTrack = tracks.some((track) => track.solo && !track.muted);
      // A soloed track takes precedence; muted and soloed-away tracks must stay silent.
      Object.entries(audioElements.current).forEach(([trackId, el]) => {
        const track = tracks.find(t => String(t.id) === String(trackId));
        const shouldPlay = track && !track.muted && (!hasSoloTrack || track.solo);
        if (el && (track?.file_url || track?.audioUrl) && shouldPlay && sessionTrackShouldPlay(track, currentTime, el.duration)) {
          el.currentTime = sessionTrackLocalTime(track, currentTime);
          attempts.push(
            el.play().then(() => true).catch((error) => {
              console.error("Multitrack playback failed:", error);
              return false;
            })
          );
        } else if (el) {
          el.pause();
        }
      });
      const futurePlayable = tracks.some(track => (track.audioUrl || track.file_url) && !track.muted &&
        (!hasSoloTrack || track.solo) && sessionTrackStart(track) > currentTime);
      if (attempts.length === 0 && !futurePlayable) {
        setIsPlaying(false);
        toast.error("Add a playable audio track, or unmute a track, before pressing Play.");
        return;
      }
      const started = await Promise.all(attempts);
      if (!started.some(Boolean) && !futurePlayable) {
        setIsPlaying(false);
        toast.error("Couldn't start track playback. Please try again.");
        return;
      }
      playbackRef.current = { from: currentTime, startedAt: performance.now() };
      setIsPlaying(true);
    } else {
      playbackRef.current = null;
      setIsPlaying(false);
      Object.values(audioElements.current).forEach(el => el?.pause());
    }
  };

  const handleStop = () => {
    playbackRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
    Object.values(audioElements.current).forEach(el => {
      if (el) { el.pause(); el.currentTime = 0; }
    });
  };

  const toggleTrackSelect = (id) =>
    setSelectedTrackIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const clearTrackSelection = () => setSelectedTrackIds([]);

  const handleDownloadTracksZip = async () => {
    const selected = tracks.filter(t => selectedTrackIds.includes(t.id));
    if (!selected.length) return;
    setZipping(true);
    try {
      await downloadFilesAsZip(selected, "session-assets.zip");
      clearTrackSelection();
    } catch (error) {
      console.error("Track ZIP export failed:", error);
      toast.error("Couldn't export the selected tracks. Please try again.");
    } finally {
      setZipping(false);
    }
  };

  const handleTimelineClick = (time) => {
    setCurrentTime(time);
    if (playbackRef.current) playbackRef.current = { from: time, startedAt: performance.now() };
    for (const track of tracks) {
      const el = audioElements.current[track.id];
      if (el) el.currentTime = sessionTrackLocalTime(track, time);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: "hsl(240 10% 3%)" }}>
      {/* Transport Controls */}
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3 flex-wrap" style={{ background: "hsl(240 8% 7% / 0.9)" }}>
        {/* Play/Stop/Rewind */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Rewind to start"
            onClick={() => handleTimelineClick(0)}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all hover:scale-105 active:scale-95"
            title="Rewind"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? "Pause playback" : "Play tracks"}
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
            type="button"
            aria-label="Stop playback"
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
            aria-label="Master playback volume"
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
            type="button"
            aria-label="Zoom out timeline"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-muted-foreground/70 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in timeline"
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

        {tracks.length > 0 && (
          <Button
            type="button"
            variant="outline" 
            size="sm" 
            className="h-8 gap-1.5 text-xs bg-secondary/50 border-border/50 hover:bg-secondary hover:text-foreground" 
            onClick={async () => {
              setZipping(true);
              try {
                await downloadFilesAsZip(tracks, `${projectTitle || selectedProject?.title || "session"}-stems.zip`);
              } catch (error) {
                console.error("Stem ZIP export failed:", error);
                toast.error("Couldn't export all stems. Please try again.");
              } finally {
                setZipping(false);
              }
            }}
            disabled={zipping}
            aria-label="Export all stems as ZIP"
            title="Download all stems as ZIP"
          >
            {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderArchive className="w-3.5 h-3.5" />}
            Export All Stems
          </Button>
        )}
      </div>

      {/* Selection toolbar */}
      {selectedTrackIds.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 bg-primary/8 flex items-center gap-3">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">{selectedTrackIds.length} track{selectedTrackIds.length > 1 ? "s" : ""} selected</span>
          <Button type="button" size="sm" aria-label="Export selected tracks as ZIP" className="rounded-lg bg-primary hover:bg-primary/90 h-7 text-xs ml-2 shadow-sm" onClick={handleDownloadTracksZip} disabled={zipping || selectedTrackIds.length === 0}>
            {zipping ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FolderArchive className="w-3 h-3 mr-1" />}
            Export ZIP
          </Button>
          <Button type="button" size="sm" aria-label="Clear selected tracks" variant="ghost" className="rounded-lg h-7 text-xs text-muted-foreground" onClick={clearTrackSelection}>
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Timeline & Tracks */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Timeline — wrapped in the same padding/checkbox layout as the track
            rows below so the ruler's width matches every waveform's width. */}
        <div className="px-3 pt-3">
          <div className="flex items-start gap-2" style={{ padding: "0 12px" }}>
            <div className="w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <Timeline
                currentTime={currentTime}
                duration={duration}
                zoom={zoom}
                onClick={handleTimelineClick}
              />
            </div>
          </div>
        </div>

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
                      : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card/70",
                    tracks.some(t => t.solo) && !track.solo && "opacity-40 grayscale"
                  )}
                  style={{ padding: "10px 12px" }}
                >
                  <Checkbox
                    aria-label={`Select ${track.name || "track"} for export`}
                    checked={selectedTrackIds.includes(track.id)}
                    onCheckedChange={() => toggleTrackSelect(track.id)}
                    className="mt-3 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <TrackStrip
                    track={track}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    isSoloedAway={tracks.some(t => t.solo) && !track.solo}
                    onUpdate={(data) => canEdit && onTrackUpdate(track.id, data)}
                    onDelete={() => canEdit && onTrackDelete(track.id)}
                    audioRef={(ref) => {
                      if (ref) {
                        audioElements.current[track.id] = ref;
                        if (Number.isFinite(ref.duration) && ref.duration > 0) {
                          setDuration((d) => Math.max(d, sessionTrackEnd(track, ref.duration)));
                        }
                        ref.onloadedmetadata = () => {
                          if (Number.isFinite(ref.duration) && ref.duration > 0) {
                            setDuration((d) => Math.max(d, sessionTrackEnd(track, ref.duration)));
                          }
                        };
                        // The session clock advances the ruler; track media timestamps are local.
                        ref.onended = () => {
                          // The shared session clock handles the final stop.
                        };
                      } else {
                        delete audioElements.current[track.id];
                      }
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