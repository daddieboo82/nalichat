import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, RotateCcw, FolderArchive, X, CheckSquare, Loader2, ZoomIn, ZoomOut, Headphones, Mic } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import TrackStrip from "./TrackStrip";
import Timeline from "./Timeline";
import BounceDialog from "./BounceDialog";
import StemQueue from "./StemQueue";
import RecordingDialog from "./RecordingDialog";
import StudioMixer from "./StudioMixer";
import StudioProperties from "./StudioProperties";
import { downloadFilesAsZip } from "@/lib/downloadZip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function MultiTrackEditor({ tracks, selectedProject, onTrackUpdate, onTrackDelete, projectTitle, canEdit = true, currentUser }) {
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(100);
  const [masterPeak, setMasterPeak] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [queue, setQueue] = useState([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [zipping, setZipping] = useState(false);
  const [recordingDialogOpen, setRecordingDialogOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const peakRef = useRef(null);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && (e.target === document.body || e.target.tagName === "BODY")) {
        e.preventDefault();
        handlePlay();
      } else if (e.code === "Backspace" && canEdit && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, canEdit]);

  // Update master peak meter
  useEffect(() => {
    const interval = setInterval(() => {
      const peaks = Object.values(audioElements.current)
        .map(el => {
          if (!el || el.paused) return 0;
          const track = tracks.find(t => t.id === Object.entries(audioElements.current).find(([_, r]) => r === el)?.[0]);
          if (track?.muted) return 0;
          return (track?.volume || 75) / 100;
        });
      const maxPeak = Math.max(...peaks, 0);
      setMasterPeak(prev => prev * 0.9 + maxPeak * 0.1);
    }, 50);
    return () => clearInterval(interval);
  }, [tracks]);

  const handlePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      // Key audio elements by track.id — find matching track to check muted state
      Object.entries(audioElements.current).forEach(([trackId, el]) => {
        const track = tracks.find(t => t.id === trackId);
        if (el && !track?.muted) {
          el.currentTime = currentTime;
          el.play().catch(() => {});
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

  useEffect(() => {
    const maxDuration = Math.max(
      ...Object.values(audioElements.current).map(el => el?.duration || 0),
      duration
    );
    if (maxDuration > duration && maxDuration !== Infinity) {
      setDuration(maxDuration);
    }
  }, [tracks.length]);

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-background">
      {/* Transport Controls */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap bg-secondary/30">
        {/* Play/Stop/Rewind */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleTimelineClick(0)}
            className="w-8 h-8 rounded-sm flex items-center justify-center bg-border/60 text-foreground/70 hover:bg-border hover:text-foreground transition-colors active:scale-95"
            title="Rewind"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
             onClick={() => setRecordingDialogOpen(true)}
             className="w-8 h-8 rounded-sm flex items-center justify-center bg-destructive/30 text-destructive hover:bg-destructive/40 transition-colors active:scale-95"
             title="Record"
           >
             <Mic className="w-4 h-4" />
           </button>
          <button
            onClick={handlePlay}
            className={cn(
              "w-10 h-10 rounded-sm flex items-center justify-center transition-all active:scale-95 font-bold",
              isPlaying
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/50"
                : "bg-primary/80 text-primary-foreground hover:bg-primary shadow-lg shadow-primary/40"
            )}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            onClick={handleStop}
            className="w-8 h-8 rounded-sm flex items-center justify-center border border-destructive/60 text-destructive/80 hover:bg-destructive/20 hover:text-destructive transition-colors active:scale-95"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
          </div>

        {/* Time display */}
        <div className="font-mono text-sm font-bold text-primary bg-secondary/40 border border-border px-3 py-2 rounded-sm min-w-[80px] text-center tabular-nums">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
        </div>

        {/* Master volume with peak meter */}
        <div className="flex items-center gap-3 px-3 py-2 bg-secondary/30 rounded-sm">
          <Headphones className="w-4 h-4 text-foreground/60 shrink-0" />
          <div className="flex flex-col gap-1 flex-1">
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
              className="w-full h-1 bg-border rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-sm [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to right, hsl(240 10% 14%), hsl(200 100% 50%) ${masterVolume}%, hsl(240 10% 14%) ${masterVolume}%)`
              }}
            />
            <div className="w-full h-0.5 bg-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${Math.min(masterPeak * 100, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-foreground/70 tabular-nums w-8">{masterVolume}dB</span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 ml-auto px-3 py-2 bg-secondary/30 rounded-sm">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
            className="w-6 h-6 rounded-sm flex items-center justify-center bg-border/60 text-foreground/70 hover:bg-border hover:text-foreground transition-colors"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[9px] font-mono font-bold text-foreground/70 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.2))}
            className="w-6 h-6 rounded-sm flex items-center justify-center bg-border/60 text-foreground/70 hover:bg-border hover:text-foreground transition-colors"
          >
            <ZoomIn className="w-3 h-3" />
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

      {/* Recording Dialog */}
      <RecordingDialog
        open={recordingDialogOpen}
        onOpenChange={setRecordingDialogOpen}
        projectId={selectedProject?.id}
        currentUser={currentUser}
        onSave={async (file, name) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          await base44.entities.Track.create({
            project_id: selectedProject.id,
            name: name || "Recording",
            file_url,
            type: "vocal",
            volume: 75,
            pan: 0,
            muted: false,
            solo: false,
            uploaded_by: currentUser.id,
            duration: 0,
          });
          queryClient.invalidateQueries({ queryKey: ["tracks", selectedProject.id] });
        }}
      />

      {/* Selection toolbar */}
      {selectedTrackIds.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-primary/10 flex items-center gap-3">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold font-mono text-primary uppercase">{selectedTrackIds.length} Track{selectedTrackIds.length > 1 ? "s" : ""} Selected</span>
          <Button size="sm" className="rounded-sm bg-primary hover:bg-primary/90 h-7 text-xs font-bold ml-auto" onClick={handleDownloadTracksZip} disabled={zipping}>
            {zipping ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FolderArchive className="w-3 h-3 mr-1" />}
            Export
          </Button>
          <Button size="sm" variant="ghost" className="rounded-sm h-7 text-xs text-foreground/60 hover:bg-border/50" onClick={clearTrackSelection}>
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Main Layout: Mixer | Timeline | Properties */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Mixer */}
        <StudioMixer
          tracks={tracks}
          onTrackUpdate={onTrackUpdate}
          selectedTrack={selectedTrack}
          onSelectTrack={setSelectedTrack}
        />

        {/* Center: Timeline & Tracks */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Timeline
            currentTime={currentTime}
            duration={duration}
            zoom={zoom}
            onClick={handleTimelineClick}
          />

          {/* Tracks Container */}
          <div className="flex-1 overflow-y-auto bg-background">
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
                    onClick={() => setSelectedTrack(track)}
                    className={cn(
                      "rounded-sm border transition-all flex items-start gap-2 cursor-pointer",
                      selectedTrack?.id === track.id
                        ? "border-primary/70 bg-primary/15 shadow-sm shadow-primary/20"
                        : "border-border/50 bg-secondary/20 hover:border-primary/50 hover:bg-secondary/35"
                    )}
                    style={{ padding: "8px 10px" }}
                  >
                    <div className="flex-1 min-w-0">
                      <TrackStrip
                          track={track}
                          isPlaying={isPlaying}
                          currentTime={currentTime}
                          onUpdate={(data) => canEdit && onTrackUpdate(track.id, data)}
                          onDelete={() => canEdit && onTrackDelete(track.id)}
                          audioRef={(ref) => {
                            if (ref) {
                              audioElements.current[track.id] = ref;
                              if (ref.duration > 0) setDuration(prev => Math.max(prev, ref.duration));
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

        {/* Right: Properties Panel */}
        <StudioProperties
          selectedTrack={selectedTrack}
          onTrackDelete={(id) => {
            onTrackDelete(id);
            setSelectedTrack(null);
          }}
          onTrackUpdate={onTrackUpdate}
        />
      </div>
    </div>
  );
}