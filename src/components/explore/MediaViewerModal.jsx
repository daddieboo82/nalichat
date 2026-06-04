import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function MediaViewerModal({ post, open, onOpenChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [open]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeChange = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl p-0 overflow-hidden">
        <div className="relative">
          {/* Image Viewer */}
          {post.image_url && (
            <div className="relative w-full bg-black/20 aspect-square overflow-hidden">
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Audio Player */}
          {post.file_url && (
            <div className="bg-gradient-to-b from-primary/10 to-background p-6 space-y-6">
              {/* Now Playing Info */}
              <div>
                <h2 className="font-heading font-semibold text-lg mb-2">{post.title}</h2>
                {post.description && (
                  <p className="text-sm text-muted-foreground mb-3">{post.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={post.creator_avatar} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {post.creator_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-semibold">{post.creator_name || "Anonymous"}</p>
                    {post.genre && <p className="text-xs text-muted-foreground">{post.genre}</p>}
                  </div>
                </div>
              </div>

              {/* Audio Player */}
              <div className="space-y-3">
                <audio
                  ref={audioRef}
                  src={post.file_url}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Play Controls */}
                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90"
                    onClick={togglePlay}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-1" />
                    )}
                  </Button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleTimeChange}
                        className="flex-1 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {(post.bpm || post.duration) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {post.bpm && (
                      <div className="bg-secondary/50 rounded-lg p-2">
                        <p className="text-muted-foreground">BPM</p>
                        <p className="font-semibold">{post.bpm}</p>
                      </div>
                    )}
                    {post.duration && (
                      <div className="bg-secondary/50 rounded-lg p-2">
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-semibold">{formatTime(post.duration)}</p>
                      </div>
                    )}
                  </div>
                )}

                {post.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}