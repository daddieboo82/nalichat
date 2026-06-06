import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Loader2, Star
} from "lucide-react";

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const h = Math.floor(m / 60);
  const mm = h > 0 ? String(m % 60).padStart(2, "0") : m;
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
};

export default function CinemaPlayer({ movie, onClose }) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const hideTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); } else { v.pause(); }
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 3000);
  }, []);

  const seek = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * duration;
  };

  const skip = (delta) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.min(Math.max(0, v.currentTime + delta), duration);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const changeVolume = (val) => {
    const v = videoRef.current;
    if (v) { v.volume = val; v.muted = val === 0; }
    setVolume(val);
    setMuted(val === 0);
  };

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black"
      >
        {/* Ambient glow from the poster */}
        <img
          src={movie.backdrop_url || movie.poster_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-125 pointer-events-none"
        />

        <div
          ref={wrapRef}
          className="relative w-full h-full flex items-center justify-center"
          onMouseMove={showControls}
          onClick={showControls}
        >
          <video
            ref={videoRef}
            src={movie.stream_url}
            className="max-w-full max-h-full w-full h-full object-contain"
            autoPlay
            playsInline
            onClick={togglePlay}
            onPlay={() => { setPlaying(true); showControls(); }}
            onPause={() => { setPlaying(false); setControlsVisible(true); }}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
            onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
          />

          {/* Center loading / play */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Loader2 className="w-12 h-12 text-white/80 animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>

          {!playing && !loading && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
                <Play className="w-9 h-9 text-white fill-white ml-1" />
              </span>
            </button>
          )}

          {/* Top bar */}
          <AnimatePresence>
            {controlsVisible && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent flex items-start justify-between"
              >
                <div className="min-w-0">
                  <h2 className="font-heading font-black text-white text-xl sm:text-2xl truncate drop-shadow">{movie.title}</h2>
                  <div className="flex items-center gap-3 text-white/70 text-sm mt-0.5">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.genre && <span className="hidden sm:inline">{movie.genre}</span>}
                    {movie.rating != null && (
                      <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                        <Star className="w-3.5 h-3.5 fill-yellow-400" />{movie.rating}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all shrink-0 ml-3"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom controls */}
          <AnimatePresence>
            {controlsVisible && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
              >
                {/* Scrubber */}
                <div className="flex items-center gap-3 text-white text-xs sm:text-sm mb-3">
                  <span className="tabular-nums">{fmt(current)}</span>
                  <div
                    className="relative flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer group"
                    onClick={seek}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `calc(${progress}% - 7px)` }}
                    />
                  </div>
                  <span className="tabular-nums">{fmt(duration)}</span>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                  <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                    {playing ? <Pause className="w-7 h-7 fill-white" /> : <Play className="w-7 h-7 fill-white" />}
                  </button>
                  <button onClick={() => skip(-10)} className="text-white/90 hover:text-white transition-colors">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button onClick={() => skip(10)} className="text-white/90 hover:text-white transition-colors">
                    <RotateCw className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-2 group">
                    <button onClick={() => changeVolume(muted ? 1 : 0)} className="text-white/90 hover:text-white transition-colors">
                      {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={muted ? 0 : volume}
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className="w-0 group-hover:w-20 transition-all duration-300 accent-primary cursor-pointer h-1"
                    />
                  </div>

                  <div className="flex-1" />

                  <button onClick={toggleFullscreen} className="text-white/90 hover:text-white transition-colors">
                    {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}