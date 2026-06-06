import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Loader2, Star, PictureInPicture2, Gauge
} from "lucide-react";

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const h = Math.floor(m / 60);
  const mm = h > 0 ? String(m % 60).padStart(2, "0") : m;
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function CinemaPlayer({ movie, onClose }) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const hideTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [skipHint, setSkipHint] = useState(null); // 'fwd' | 'back'

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
        setSpeedOpen(false);
      }
    }, 3000);
  }, []);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration || 0);
    setSkipHint(delta > 0 ? "fwd" : "back");
    setTimeout(() => setSkipHint(null), 500);
  }, []);

  const changeVolume = useCallback((val) => {
    const v = videoRef.current;
    if (v) { v.volume = val; v.muted = val === 0; }
    setVolume(val);
    setMuted(val === 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture?.();
    } catch { /* unsupported */ }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      switch (e.key) {
        case "Escape": if (!document.fullscreenElement) onClose(); break;
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "ArrowUp": e.preventDefault(); changeVolume(Math.min(1, (videoRef.current?.volume ?? 1) + 0.1)); break;
        case "ArrowDown": e.preventDefault(); changeVolume(Math.max(0, (videoRef.current?.volume ?? 1) - 0.1)); break;
        case "m": changeVolume(muted ? 1 : 0); break;
        case "f": toggleFullscreen(); break;
        case "p": togglePiP(); break;
        default: break;
      }
      showControls();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.body.style.overflow = "";
    };
  }, [onClose, togglePlay, skip, changeVolume, toggleFullscreen, togglePiP, showControls, muted]);

  const setPlaybackRate = (r) => {
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    setSpeed(r);
    setSpeedOpen(false);
  };

  const seek = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * duration;
  };

  const onProgress = (e) => {
    const v = e.target;
    if (v.buffered.length) setBuffered((v.buffered.end(v.buffered.length - 1) / (v.duration || 1)) * 100);
  };

  const progress = duration ? (current / duration) * 100 : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const ambient = movie.backdrop_url || movie.poster_url;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black"
      >
        {/* Theater-mode ambient light bleed from the film */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.img
            src={ambient}
            alt=""
            animate={{ scale: playing ? [1.25, 1.35, 1.25] : 1.25 }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[80px]"
          />
          <div className="absolute -inset-1/4 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_75%)]" />
        </div>

        <div
          ref={wrapRef}
          className="relative w-full h-full flex items-center justify-center"
          onMouseMove={showControls}
          onClick={showControls}
        >
          <video
            ref={videoRef}
            src={movie.stream_url}
            className="relative z-10 max-w-full max-h-full w-full h-full object-contain shadow-[0_0_120px_rgba(0,0,0,0.9)]"
            autoPlay
            playsInline
            onClick={togglePlay}
            onPlay={() => { setPlaying(true); showControls(); }}
            onPause={() => { setPlaying(false); setControlsVisible(true); }}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            onProgress={onProgress}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
            onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
          />

          {/* Double-tap skip hints */}
          <AnimatePresence>
            {skipHint && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className={`absolute z-20 top-1/2 -translate-y-1/2 ${skipHint === "fwd" ? "right-[18%]" : "left-[18%]"} w-20 h-20 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center pointer-events-none`}
              >
                {skipHint === "fwd" ? <RotateCw className="w-8 h-8 text-white" /> : <RotateCcw className="w-8 h-8 text-white" />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center loading */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute z-20 inset-0 flex items-center justify-center pointer-events-none"
              >
                <Loader2 className="w-12 h-12 text-white/80 animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>

          {!playing && !loading && (
            <button onClick={togglePlay} className="absolute z-20 inset-0 flex items-center justify-center">
              <span className="w-24 h-24 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
                <Play className="w-11 h-11 text-white fill-white ml-1.5" />
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
                className="absolute z-30 top-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent flex items-start justify-between"
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
                className="absolute z-30 bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
              >
                {/* Scrubber */}
                <div className="flex items-center gap-3 text-white text-xs sm:text-sm mb-3">
                  <span className="tabular-nums">{fmt(current)}</span>
                  <div
                    className="relative flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer group"
                    onClick={seek}
                  >
                    <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${buffered}%` }} />
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
                      <VolIcon className="w-5 h-5" />
                    </button>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={muted ? 0 : volume}
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className="w-16 sm:w-0 sm:group-hover:w-20 transition-all duration-300 accent-primary cursor-pointer h-1"
                    />
                  </div>

                  <div className="flex-1" />

                  {/* Playback speed */}
                  <div className="relative">
                    <button
                      onClick={() => setSpeedOpen((o) => !o)}
                      className="flex items-center gap-1 text-white/90 hover:text-white transition-colors text-sm font-semibold"
                    >
                      <Gauge className="w-5 h-5" /> {speed}x
                    </button>
                    <AnimatePresence>
                      {speedOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="absolute bottom-9 right-0 bg-black/90 backdrop-blur-md border border-white/15 rounded-xl p-1 w-24"
                        >
                          {SPEEDS.map((r) => (
                            <button
                              key={r}
                              onClick={() => setPlaybackRate(r)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${speed === r ? "bg-primary text-white" : "text-white/80 hover:bg-white/10"}`}
                            >
                              {r}x
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button onClick={togglePiP} className="hidden sm:block text-white/90 hover:text-white transition-colors">
                    <PictureInPicture2 className="w-5 h-5" />
                  </button>

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