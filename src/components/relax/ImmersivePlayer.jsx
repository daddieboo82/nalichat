import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Star, Play } from "lucide-react";
import { toEmbedUrl, isDirectMedia, FALLBACK_THUMB } from "@/lib/relaxConfig";

export default function ImmersivePlayer({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!item) return null;

  const backdrop = item.backdrop_url || item.thumbnail_url || FALLBACK_THUMB;
  const isLink = item.media_type === "link";
  const direct = isDirectMedia(item.media_url);
  const embed = toEmbedUrl(item.media_url, item.media_type);
  const isYouTube = /youtube\.com|youtu\.be/.test(item.media_url || "");

  const renderStage = () => {
    if (isLink) {
      return (
        <div className="w-full aspect-video rounded-2xl overflow-hidden relative flex items-center justify-center bg-black">
          <img src={backdrop} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-40" />
          <a
            href={item.media_url}
            className="relative z-10 flex items-center gap-3 bg-white text-black font-bold px-7 py-4 rounded-full hover:scale-105 transition-transform shadow-2xl"
          >
            <ExternalLink className="w-5 h-5" /> Launch {item.title}
          </a>
        </div>
      );
    }
    if (item.media_type === "audio" && direct) {
      return (
        <div className="w-full rounded-2xl overflow-hidden relative bg-black p-6">
          <img src={backdrop} alt={item.title} className="w-full h-64 object-cover rounded-xl mb-4" />
          <audio src={item.media_url} controls autoPlay className="w-full" />
        </div>
      );
    }
    if (direct) {
      return (
        <video
          src={item.media_url}
          controls
          autoPlay
          className="w-full aspect-video rounded-2xl bg-black"
        />
      );
    }
    // iframe-embeddable (YouTube, Vimeo, Spotify, web apps)
    return (
      <iframe
        src={embed}
        title={item.title}
        className="w-full aspect-video rounded-2xl bg-black"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
        allowFullScreen
      />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      >
        {/* Immersive blurred backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose} />
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-3xl scale-110 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

        <motion.div
          initial={{ scale: 0.92, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 30, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          className="relative z-10 w-full max-w-5xl"
        >
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 sm:top-0 sm:-right-12 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            aria-label="Close player"
          >
            <X className="w-5 h-5" />
          </button>

          {renderStage()}

          {isYouTube && !direct && (
            <a
              href={item.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Video won't play? Watch on YouTube
            </a>
          )}

          <div className="mt-5 px-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="font-heading font-black text-2xl sm:text-3xl text-white drop-shadow">{item.title}</h2>
              {item.year && <span className="text-sm text-white/60">{item.year}</span>}
              {item.rating != null && (
                <span className="flex items-center gap-1 text-sm font-bold text-yellow-400">
                  <Star className="w-4 h-4 fill-yellow-400" /> {item.rating}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-white/80 max-w-2xl leading-relaxed">{item.description}</p>
            )}
            {Array.isArray(item.tags) && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {item.tags.map((t) => (
                  <span key={t} className="text-xs bg-white/10 text-white/80 px-3 py-1 rounded-full">#{t}</span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}