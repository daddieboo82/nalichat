import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Star, Clock, Film, Loader2, RefreshCw, Sparkles } from "lucide-react";

export default function TonightsPicks({ movies = [], loading, onPlay, onRefresh, isAdmin }) {
  const [active, setActive] = useState(0);
  const featured = movies[active];

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Cinematic backdrop with crossfade */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {featured?.backdrop_url && (
            <motion.img
              key={featured.id}
              initial={{ opacity: 0, scale: 1.12 }}
              animate={{ opacity: 0.5, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              src={featured.backdrop_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
      </div>

      <div className="relative px-4 sm:px-8 pt-10 pb-16 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
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
        <h1 className="font-heading font-black text-4xl sm:text-6xl text-gradient-animate mb-2 leading-tight">Pick Your Movie</h1>
        <p className="text-muted-foreground max-w-lg mb-10">Three hand-picked films, freshly rotated every day. Choose one and step into the theater.</p>

        {loading && movies.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" /> Curating tonight's picks…
          </div>
        ) : movies.length === 0 ? (
          <div className="py-16 text-muted-foreground">No picks available yet.</div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-8 items-center">
            {/* Featured spotlight */}
            <AnimatePresence mode="wait">
              <motion.div
                key={featured?.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.4 }}
                className="lg:col-span-3 order-2 lg:order-1"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-heading font-bold tracking-wider uppercase text-primary">Now Featuring</span>
                </div>
                <h2 className="font-heading font-black text-3xl sm:text-4xl text-foreground mb-3 leading-tight">{featured?.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 flex-wrap">
                  {featured?.year && <span>{featured.year}</span>}
                  {featured?.runtime && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{featured.runtime}</span>}
                  {featured?.rating != null && <span className="flex items-center gap-1 text-yellow-400 font-semibold"><Star className="w-4 h-4 fill-yellow-400" />{featured.rating}</span>}
                  {featured?.genre && (
                    <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-foreground/80 px-2.5 py-1 rounded-full">
                      <Film className="w-3 h-3" />{featured.genre}
                    </span>
                  )}
                </div>
                {featured?.description && (
                  <p className="text-muted-foreground leading-relaxed max-w-xl mb-6 line-clamp-4">{featured.description}</p>
                )}
                <button
                  onClick={() => onPlay(featured)}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-r from-primary to-accent text-white font-bold px-8 py-3.5 rounded-full hover:scale-105 transition-transform glow-primary"
                >
                  <Play className="w-5 h-5 fill-white" /> Play in Theater
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Pick selector */}
            <div className="lg:col-span-2 order-1 lg:order-2 grid grid-cols-3 lg:grid-cols-1 gap-3">
              {movies.slice(0, 3).map((m, i) => (
                <motion.button
                  key={m.id}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => (active === i ? onPlay(m) : setActive(i))}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`group relative text-left rounded-2xl overflow-hidden border transition-all duration-300 ${
                    active === i ? "border-primary/70 glow-primary scale-[1.02]" : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="aspect-[2/3] lg:aspect-[16/7] relative bg-black">
                    <img
                      src={m.poster_url}
                      alt={m.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                    <span className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center font-heading font-black text-white text-xs">
                      {i + 1}
                    </span>
                    {active === i && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-3">
                      <h3 className="font-heading font-bold text-white text-sm leading-tight drop-shadow line-clamp-2">{m.title}</h3>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}