import { useMediaPlayer } from "@/lib/MediaPlayerContext";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume2, X, Maximize2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function GlobalMediaPlayer() {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev, currentTime, duration, volume, setVolume, seek, clearQueue, queue } = useMediaPlayer();
  const [showVolume, setShowVolume] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seek(percent * duration);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 backdrop-blur-sm z-40 safe-bottom">
      {/* Progress bar */}
      <div
        className="h-1 bg-primary/30 cursor-pointer hover:bg-primary/50 transition-colors"
        onClick={handleProgressClick}
        style={{
          width: `${duration ? (currentTime / duration) * 100 : 0}%`,
        }}
      />

      {/* Player */}
      <div className="max-h-[88px] overflow-hidden">
        <div className="px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Track Info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                <AvatarImage src={currentTrack.image_url || currentTrack.creator_avatar} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {currentTrack.title?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold truncate">{currentTrack.title}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {currentTrack.creator_name || "Anonymous"}
                </p>
              </div>
            </div>

            {/* Controls — hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-1">
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={skipPrev} title="Previous">
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button size="icon" className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={skipNext} title="Next">
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Play button for mobile */}
            <div className="sm:hidden">
              <Button size="icon" className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </Button>
            </div>

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1 relative">
              <button
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors relative"
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
                title="Volume"
              >
                <Volume2 className="w-4 h-4" />
                {showVolume && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-secondary px-2 py-1 rounded-lg whitespace-nowrap text-xs">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-24 h-1 accent-primary"
                    />
                  </div>
                )}
              </button>
            </div>

            {/* Time display */}
            <div className="hidden sm:flex text-xs text-muted-foreground gap-1 shrink-0">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Close */}
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={clearQueue} title="Close player">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}