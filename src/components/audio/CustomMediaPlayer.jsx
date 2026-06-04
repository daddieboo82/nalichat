import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CustomMediaPlayer({ src, className, title }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Optional: Pause other audio elements on the page if desired
      document.querySelectorAll("audio").forEach(el => {
        if (el !== audioRef.current) {
          el.pause();
        }
      });
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (val) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = val[0];
    setCurrentTime(val[0]);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex flex-col gap-2 p-3 bg-secondary/30 rounded-xl border border-border/50", className)} onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={togglePlay}
          className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all shadow-md"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </Button>
        
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {title && <p className="text-xs font-semibold truncate px-1 text-foreground/90">{title}</p>}
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-muted-foreground w-8 text-right font-mono tabular-nums">{formatTime(currentTime)}</span>
            <Slider 
              value={[currentTime]} 
              max={duration || 100} 
              step={0.1} 
              onValueChange={handleSeek}
              className="flex-1 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5" 
            />
            <span className="text-[10px] text-muted-foreground w-8 font-mono tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 w-20 hidden sm:flex">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-6 h-6 text-muted-foreground hover:text-foreground" 
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </Button>
          <Slider 
            value={[isMuted ? 0 : volume]} 
            max={1} 
            step={0.01} 
            onValueChange={(v) => {
              setIsMuted(v[0] === 0);
              setVolume(v[0]);
            }}
            className="w-12 [&_[role=slider]]:w-2 [&_[role=slider]]:h-2" 
          />
        </div>
      </div>
    </div>
  );
}