import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Star, Clock, Film, Loader2, RefreshCw } from "lucide-react";

export default function TonightsPicks({ movies = [], loading, onPlay, onRefresh, isAdmin }) {
  const [active, setActive] = useState(0);
  const featured = movies[active];

  return (
    <div className="relative overflow-hidden">
      {/* Cinematic backdrop */}
      <div className="absolute inset-0">
        {featured?.backdrop_url && (
          <motion.img
            key={featured.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 0.45, scale: 1 }}
            transition={{ duration: 0.8 }}
            src={featured.backdrop_url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />
      </div>

      <div className="relative px-4 sm:px-8 pt-10 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-accent font-heading font-bold text-sm tracking-widest uppercase">Tonight's Cinema</span>
          </div>
          {isAdmin && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> New picks
            </button>
          )}
        </div>
        <h1 className="font-heading font-black text-3xl sm:text-5xl text-gradient-animate mb-2">Pick Your Movie</h1>
        <p className="text-muted-foreground max-w-lg mb-8">Three hand-picked public-domain classics, freshly rotated every day. Choose one and dive into the cinema.</p>

        {loading && movies.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" /> Curating tonight's picks…
          </div>
        ) : movies.length === 0 ? (
          <div className="py-12 text-muted-foreground">No picks available yet.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {movies.slice(0, 3).map((m, i) => (
              <motion.button
                key={m.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPlay(m)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`group relative text-left rounded-2xl overflow-hidden border transition-all duration-300 ${
                  active === i ? "border-primary/60 glow-primary scale-[1.015]" : "border-white/10 hover:border-white/25"
                }`}
              >
                <div className="aspect-[2/3] sm:aspect-[16/10] lg:aspect-[2/3] relative bg-black">
                  <img
                    src={m.poster_url}
                    alt={m.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                  {/* Slot number */}
                  <span className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center font-heading font-black text-white text-sm">
                    {i + 1}
                  </span>

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center">
                      <Play className="w-7 h-7 text-white fill-white ml-1" />
                    </span>
                  </div>

                  {/* Info */}
                  <div className="absolute bottom-0 inset-x-0 p-4">
                    <h3 className="font-heading font-black text-white text-lg leading-tight drop-shadow line-clamp-2">{m.title}</h3>
                    <div className="flex items-center gap-3 text-white/70 text-xs mt-1.5 flex-wrap">
                      {m.year && <span>{m.year}</span>}
                      {m.runtime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.runtime}</span>}
                      {m.rating != null && <span className="flex items-center gap-1 text-yellow-400 font-semibold"><Star className="w-3 h-3 fill-yellow-400" />{m.rating}</span>}
                    </div>
                    {m.genre && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[11px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full">
                        <Film className="w-3 h-3" />{m.genre}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}