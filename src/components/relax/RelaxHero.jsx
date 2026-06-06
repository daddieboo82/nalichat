import { motion } from "framer-motion";
import { Play, ExternalLink, Star, Sparkles } from "lucide-react";
import { FALLBACK_THUMB } from "@/lib/relaxConfig";

export default function RelaxHero({ item, onOpen }) {
  if (!item) return null;
  const isLink = item.media_type === "link";
  const bg = item.backdrop_url || item.thumbnail_url || FALLBACK_THUMB;

  return (
    <div className="relative h-[58vh] min-h-[420px] w-full overflow-hidden">
      <img src={bg} alt={item.title} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_THUMB; }} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-10 max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 text-primary text-xs font-bold px-3 py-1 rounded-full mb-4 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" /> Featured · Relax & Recharge
        </div>
        <h1 className="font-heading font-black text-4xl sm:text-6xl text-white drop-shadow-2xl mb-3 leading-tight">{item.title}</h1>
        <div className="flex items-center gap-3 mb-3 text-white/70 text-sm">
          {item.year && <span>{item.year}</span>}
          {item.rating != null && (
            <span className="flex items-center gap-1 font-bold text-yellow-400">
              <Star className="w-4 h-4 fill-yellow-400" /> {item.rating}
            </span>
          )}
        </div>
        {item.description && <p className="text-white/85 text-base sm:text-lg max-w-xl line-clamp-3 mb-6 drop-shadow">{item.description}</p>}
        <button
          onClick={() => onOpen(item)}
          className="flex items-center gap-3 bg-white text-black font-bold px-7 py-3.5 rounded-full hover:scale-105 transition-transform shadow-2xl"
        >
          {isLink ? <ExternalLink className="w-5 h-5" /> : <Play className="w-5 h-5 fill-black" />}
          {isLink ? "Launch" : "Play Now"}
        </button>
      </motion.div>
    </div>
  );
}