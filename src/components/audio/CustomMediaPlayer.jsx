import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, FastForward, Rewind, Wand2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AudioWaveform from "../messages/AudioWaveform";
import VoiceEffectsBar from "../messages/VoiceEffectsBar";

export default function CustomMediaPlayer({ src, className, title }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [activeFilter, setActiveFilter] = useState("original");
  const [duetMode, setDuetMode] = useState("off");
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const filterRef = useRef(null);
  const delayRef = useRef(null);
  const feedbackRef = useRef(null);
  const dryGainRef = useRef(null);
  const wetGainRef = useRef(null);
  const masterGainRef = useRef(null);
  const duetAudioRef = useRef(null);
  const duetGainRef = useRef(null);
  const graphReadyRef = useRef(false);

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
      duetAudioRef.current?.pause();
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

  // Initialize Web Audio API graph for real-time voice effects
  const initAudioGraph = () => {
    if (graphReadyRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audio);
    const filter = ctx.createBiquadFilter();
    filter.type = "allpass";
    filterRef.current = filter;

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0;
    delayRef.current = delay;

    const feedback = ctx.createGain();
    feedback.gain.value = 0;
    feedbackRef.current = feedback;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;
    dryGainRef.current = dryGain;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0;
    wetGainRef.current = wetGain;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGainRef.current = masterGain;

    // source → filter → [dry + wet(delay+feedback)] → master → destination
    source.connect(filter);
    filter.connect(dryGain);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Duet layer — second audio element with pitch shift via playbackRate
    const duetAudio = new Audio(src);
    duetAudio.crossOrigin = "anonymous";
    duetAudio.preload = "metadata";
    duetAudioRef.current = duetAudio;

    const duetSource = ctx.createMediaElementSource(duetAudio);
    const duetGain = ctx.createGain();
    duetGain.gain.value = 0;
    duetGainRef.current = duetGain;
    duetSource.connect(duetGain);
    duetGain.connect(ctx.destination);

    graphReadyRef.current = true;
  };

  const applyFilter = (presetId) => {
    initAudioGraph();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const presets = {
      original: { type: "allpass", freq: 1000, Q: 0, delay: 0, feedback: 0, wet: 0 },
      deep: { type: "lowpass", freq: 400, Q: 1, delay: 0, feedback: 0, wet: 0 },
      bright: { type: "highpass", freq: 2000, Q: 1, delay: 0, feedback: 0, wet: 0 },
      robot: { type: "bandpass", freq: 1200, Q: 8, delay: 0, feedback: 0, wet: 0 },
      echo: { type: "allpass", freq: 1000, Q: 0, delay: 0.25, feedback: 0.4, wet: 0.6 },
      lofi: { type: "lowpass", freq: 2500, Q: 0.5, delay: 0, feedback: 0, wet: 0 },
    };
    const p = presets[presetId] || presets.original;
    const t = ctx.currentTime;
    filterRef.current.type = p.type;
    filterRef.current.frequency.setTargetAtTime(p.freq, t, 0.02);
    filterRef.current.Q.setTargetAtTime(p.Q, t, 0.02);
    delayRef.current.delayTime.setTargetAtTime(p.delay, t, 0.02);
    feedbackRef.current.gain.setTargetAtTime(p.feedback, t, 0.02);
    wetGainRef.current.gain.setTargetAtTime(p.wet, t, 0.02);
    setActiveFilter(presetId);
  };

  const setDuet = (mode) => {
    initAudioGraph();
    const duetAudio = duetAudioRef.current;
    const duetGain = duetGainRef.current;
    if (!duetAudio || !duetGain) return;
    if (mode === "off") {
      duetGain.gain.value = 0;
      duetAudio.pause();
    } else {
      duetAudio.playbackRate = mode === "high" ? 1.5 : 0.667;
      duetGain.gain.value = 0.45;
      duetAudio.currentTime = audioRef.current?.currentTime || 0;
      if (audioRef.current && !audioRef.current.paused) {
        duetAudio.play().catch(() => {});
      }
    }
    setDuetMode(mode);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (duetAudioRef.current) {
        duetAudioRef.current.pause();
        duetAudioRef.current.src = "";
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (graphReadyRef.current && audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      duetAudioRef.current?.pause();
    } else {
      document.querySelectorAll("audio").forEach(el => {
        if (el !== audioRef.current && el !== duetAudioRef.current) {
          el.pause();
        }
      });
      audioRef.current.play().catch(console.error);
      if (duetMode !== "off" && duetAudioRef.current) {
        duetAudioRef.current.currentTime = audioRef.current.currentTime;
        duetAudioRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (val) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = val[0];
    if (duetAudioRef.current) duetAudioRef.current.currentTime = val[0];
    setCurrentTime(val[0]);
  };

  const skipForward = (e) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, duration);
    }
  };

  const skipBackward = (e) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Animated EQ bars
  const eqBars = Array.from({ length: 6 }).map((_, i) => (
    <motion.div
      key={i}
      className="w-1 bg-primary rounded-full origin-bottom"
      initial={{ height: 4 }}
      animate={{
        height: isPlaying ? [4, Math.random() * 12 + 8, Math.random() * 6 + 4, 4] : 4,
      }}
      transition={{
        duration: isPlaying ? 0.6 : 0.3,
        repeat: isPlaying ? Infinity : 0,
        delay: i * 0.1,
        ease: "easeInOut"
      }}
    />
  ));

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-2xl p-[1px] transition-all duration-500",
        isHovered ? "shadow-lg shadow-primary/20 scale-[1.01]" : "shadow-md",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Animated gradient border background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-r from-primary/60 via-accent/60 to-primary/60 opacity-50",
        isPlaying ? "" : "opacity-30"
      )} style={{ backgroundSize: '200% 200%', animation: isPlaying ? 'gradient-shift 3s ease infinite' : 'none' }} />
      
      {/* Main player content */}
      <div className="relative bg-card/95 backdrop-blur-xl rounded-2xl p-4 flex flex-col gap-4">
        <audio 
          ref={audioRef} 
          src={src} 
          preload="metadata" 
          playsInline
          webkitPlaysInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
        />
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Visualizer or vinyl record */}
            <div className={cn(
              "relative w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden transition-all duration-500 border-2",
              isPlaying ? "bg-secondary border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "bg-secondary/50 border-border"
            )}>
               {isPlaying ? (
                 <div className="flex items-end justify-center gap-[2px] h-5 w-8">
                   {eqBars}
                 </div>
               ) : (
                 <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                   <div className="w-1.5 h-1.5 bg-primary/50 rounded-full" />
                 </div>
               )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {title && (
                <motion.p 
                  className="text-sm font-bold truncate text-foreground tracking-tight"
                  animate={isHovered ? { x: 2 } : { x: 0 }}
                >
                  {title}
                </motion.p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-primary font-mono tabular-nums bg-primary/10 px-1.5 py-0.5 rounded-md">
                  {formatTime(currentTime)}
                </span>
                <span className="text-[10px] text-muted-foreground">/</span>
                <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 hidden sm:flex"
              onClick={skipBackward}
            >
              <Rewind className="w-3.5 h-3.5" />
            </Button>
            
            <Button 
              variant="default" 
              size="icon" 
              onClick={togglePlay}
              className={cn(
                "w-12 h-12 rounded-full shadow-lg transition-all duration-300 transform",
                isPlaying 
                  ? "bg-accent hover:bg-accent/90 text-accent-foreground shadow-accent/30 hover:scale-105" 
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/30 hover:scale-105"
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isPlaying ? "pause" : "play"}
                  initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                </motion.div>
              </AnimatePresence>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 hidden sm:flex"
              onClick={skipForward}
            >
              <FastForward className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full group/slider px-1 mt-1">
          <div className="relative flex-1 h-10 flex items-center">
            <div className="absolute inset-0 pointer-events-none opacity-80 flex items-center">
              <AudioWaveform isPlaying={isPlaying} progress={duration ? (currentTime / duration) * 100 : 0} />
            </div>
            <Slider 
              value={[currentTime]} 
              max={duration || 100} 
              step={0.1} 
              onValueChange={handleSeek}
              className="relative z-10 w-full cursor-pointer [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:opacity-0 group-hover/slider:[&_[role=slider]]:opacity-100 transition-all [&_[role=slider]]:transition-opacity [&_[role=slider]]:border-primary [&_[role=slider]]:shadow-sm" 
            />
          </div>
          
          <div className="flex items-center gap-2 shrink-0 w-24 hidden sm:flex">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-6 h-6 text-muted-foreground hover:text-foreground" 
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
            <Slider 
              value={[isMuted ? 0 : volume]} 
              max={1} 
              step={0.01} 
              onValueChange={(v) => {
                setIsMuted(v[0] === 0);
                setVolume(v[0]);
              }}
              className="w-12 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5 [&_[role=slider]]:opacity-0 group-hover/slider:[&_[role=slider]]:opacity-100 transition-all" 
            />
          </div>

          {/* FX Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!showEffects) initAudioGraph();
              setShowEffects(!showEffects);
            }}
            className={cn(
              "shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all touch-manipulation",
              showEffects ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            )}
            title="Voice Effects"
            aria-label="Voice Effects"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Voice Effects Bar */}
        {showEffects && (
          <VoiceEffectsBar
            activeFilter={activeFilter}
            onFilterChange={applyFilter}
            duetMode={duetMode}
            onDuetChange={setDuet}
            audioCtxRef={audioCtxRef}
          />
        )}
      </div>
    </div>
  );
}