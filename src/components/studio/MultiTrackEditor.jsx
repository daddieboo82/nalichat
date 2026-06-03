import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, RotateCcw, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import TrackStrip from "./TrackStrip";
import Timeline from "./Timeline";
import BounceDialog from "./BounceDialog";

export default function MultiTrackEditor({ tracks, selectedProject, onTrackUpdate, onTrackDelete, projectTitle }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(100);
  const [zoom, setZoom] = useState(1);
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

  const handleTimelineClick = (time) => {
    setCurrentTime(time);
    Object.values(audioElements.current).forEach(el => {
      if (el) el.currentTime = time;
    });
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Transport Controls */}
      <div className="px-6 py-3 border-b border-border bg-card/50 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
              isPlaying ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary hover:bg-primary/30"
            )}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={handleStop}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTimelineClick(0)}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Time display */}
        <div className="font-mono text-sm text-muted-foreground">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
            className="px-2 py-1 text-xs rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            −
          </button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.2))}
            className="px-2 py-1 text-xs rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            +
          </button>
        </div>

        {/* Master volume */}
        <div className="flex items-center gap-2 ml-4">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
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
            className="w-20 h-1 rounded-full bg-secondary appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${masterVolume}%, hsl(var(--secondary)) ${masterVolume}%, hsl(var(--secondary)) 100%)`
            }}
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{masterVolume}%</span>
        </div>

        {/* Bounce Button */}
        <div className="ml-4">
          <BounceDialog projectTitle={projectTitle || selectedProject?.title} tracks={tracks} />
        </div>
      </div>

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
          <div className="space-y-2 p-4">
            {tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                <p className="font-heading font-semibold">No tracks loaded</p>
                <p className="text-sm mt-1">Add audio files to start mixing</p>
              </div>
            ) : (
              tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="bg-card rounded-xl border border-border p-3 hover:border-primary/50 transition-colors"
                >
                  <TrackStrip
                    track={track}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onUpdate={(data) => onTrackUpdate(track.id, data)}
                    onDelete={() => onTrackDelete(track.id)}
                    audioRef={(ref) => {
                      if (ref) audioElements.current[idx] = ref;
                    }}
                    masterVolume={masterVolume}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}