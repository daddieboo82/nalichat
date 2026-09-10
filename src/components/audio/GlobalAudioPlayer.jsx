import React from 'react';
import { useAudioPlayer, useAudioPlayerTime } from '@/lib/AudioPlayerContext';
import { Play, Pause, X, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlobalAudioPlayer() {
  const player = useAudioPlayer();
  const { currentTime, duration } = useAudioPlayerTime();
  if (!player || !player.currentTrack) return null;
  const { currentTrack, isPlaying, volume, setVolume, togglePlay, seek, closePlayer } = player;
  
  const displayDuration = duration || currentTrack?.duration || 0;

  const formatTime = (seconds, isDuration = false) => {
    if (!seconds || isNaN(seconds)) return isDuration ? "--:--" : "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] md:bottom-[53px] left-0 right-0 z-50 bg-black/95 backdrop-blur-3xl border-t border-white/10 shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.5)] text-white safe-bottom"
      >
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 group cursor-pointer hover:h-2 transition-all" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          seek(percent * displayDuration);
        }}>
          <div 
            className="absolute top-0 left-0 h-full bg-white transition-all"
            style={{ width: `${(currentTime / (displayDuration || 1)) * 100}%` }}
          >
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </div>
        </div>

        <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-4">
          
          {/* Track Info */}
          <div className="flex items-center gap-3 w-1/3 min-w-0">
            <Avatar className="w-10 h-10 md:w-12 md:h-12 rounded-lg shadow-md border border-white/10 hidden sm:block">
              <AvatarImage src={currentTrack.image_url || currentTrack.creator_avatar} className="object-cover" />
              <AvatarFallback className="bg-primary/20 text-primary rounded-lg">
                {currentTrack.title?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h4 className="text-sm font-bold truncate text-white leading-tight">{currentTrack.title}</h4>
              <p className="text-xs text-white/50 truncate font-medium tracking-wide">{currentTrack.creator_name || "Unknown Artist"}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center justify-center flex-1 max-w-md">
            <div className="flex items-center gap-4 md:gap-6">
              <Button
                variant="ghost"
                size="icon"
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </Button>
            </div>
            <div className="hidden md:flex items-center gap-2 w-full mt-1.5">
              <span className="text-xs text-white/50 w-8 text-right font-mono">{formatTime(currentTime)}</span>
              <Slider 
                value={[currentTime]} 
                max={displayDuration || 100} 
                step={0.1} 
                onValueChange={(v) => seek(v[0])}
                className="flex-1 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-white/50 [&_.bg-primary]:bg-white [&_.bg-primary\\/20]:bg-white/20" 
              />
              <span className="text-xs text-white/50 w-8 font-mono">{formatTime(displayDuration, true)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center justify-end gap-2 w-1/3 min-w-0">
             <div className="hidden lg:flex items-center gap-2 w-32 mr-4">
                <Button variant="ghost" size="icon" title={volume === 0 ? "Unmute" : "Mute"} aria-label={volume === 0 ? "Unmute" : "Mute"} className="w-8 h-8 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setVolume(volume === 0 ? 1 : 0)}>
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider 
                  value={[volume]} 
                  max={1} 
                  step={0.01} 
                  onValueChange={(v) => setVolume(v[0])}
                  className="w-20 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-white/50" 
                />
             </div>
             <Button variant="ghost" size="icon" title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"} className="w-8 h-8 text-white/60 hover:bg-white/10 hover:text-white md:hidden" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
             </Button>
             <Button variant="ghost" size="icon" title="Close Player" aria-label="Close Player" className="w-8 h-8 text-white/60 hover:bg-white/10 hover:text-white transition-colors rounded-full" onClick={closePlayer}>
               <X className="w-4 h-4" />
             </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}