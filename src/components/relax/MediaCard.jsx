import { motion } from "framer-motion";
import { Play, ExternalLink, Star, Pencil, Trash2 } from "lucide-react";
import { FALLBACK_THUMB } from "@/lib/relaxConfig";

export default function MediaCard({ item, onOpen, isAdmin, onEdit, onDelete }) {
  const isLink = item.media_type === "link";
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="group relative shrink-0 w-44 sm:w-52 cursor-pointer"
      onClick={() => onOpen(item)}
    >
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card aspect-[2/3] shadow-lg group-hover:border-primary/50 group-hover:shadow-primary/20 group-hover:shadow-2xl transition-all">
        <img
          src={item.thumbnail_url || FALLBACK_THUMB}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_THUMB; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
            {isLink ? <ExternalLink className="w-6 h-6 text-black" /> : <Play className="w-6 h-6 text-black fill-black ml-0.5" />}
          </div>
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors"
              aria-label="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item); }}
              className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-destructive transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-heading font-bold text-sm text-white truncate drop-shadow">{item.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {item.year && <span className="text-[10px] text-white/60">{item.year}</span>}
            {item.rating != null && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-yellow-400">
                <Star className="w-3 h-3 fill-yellow-400" /> {item.rating}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}