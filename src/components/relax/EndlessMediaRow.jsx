import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Infinity as InfinityIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getCategoryMeta } from "@/lib/relaxConfig";
import MediaCard from "./MediaCard";

// An endless, AI-powered recommendation row. Loads a fresh batch of titles and
// keeps loading more as the user scrolls toward the end — never runs out.
export default function EndlessMediaRow({ categoryKey, onOpen }) {
  const scroller = useRef(null);
  const meta = getCategoryMeta(categoryKey);
  const Icon = meta.icon;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("recommendMedia", {
        category: categoryKey,
        exclude: Array.from(seen.current),
        count: 12,
      });
      const fresh = (res?.data?.items || []).filter((it) => {
        if (!it.title || seen.current.has(it.title)) return false;
        seen.current.add(it.title);
        return true;
      });
      setItems((prev) => [...prev, ...fresh.map((it, i) => ({ ...it, id: `${it.title}-${prev.length + i}` }))]);
    } finally {
      setLoading(false);
    }
  }, [categoryKey, loading]);

  // Initial load
  useEffect(() => { loadMore(); /* eslint-disable-next-line */ }, []);

  const scroll = (dir) => scroller.current?.scrollBy({ left: dir * 600, behavior: "smooth" });

  const handleScroll = () => {
    const el = scroller.current;
    if (!el) return;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 800) loadMore();
  };

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl text-foreground flex items-center gap-2">
              {meta.label} <InfinityIcon className="w-4 h-4 text-primary" />
            </h2>
            <p className="text-xs text-muted-foreground">Endless AI recommendations — keep scrolling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center transition-colors" aria-label="Scroll left">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center transition-colors" aria-label="Scroll right">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto px-4 sm:px-8 pb-4 scrollbar-none scroll-smooth"
      >
        {items.map((item) => (
          <MediaCard key={item.id} item={item} onOpen={onOpen} isAdmin={false} />
        ))}

        {loading && (
          <div className="shrink-0 w-44 sm:w-52 aspect-[2/3] rounded-2xl border border-border bg-card flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="shrink-0 w-full py-10 text-center text-sm text-muted-foreground">
            Could not load recommendations. Try again later.
          </div>
        )}
      </div>
    </div>
  );
}