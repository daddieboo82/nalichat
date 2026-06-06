import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { RELAX_CATEGORIES } from "@/lib/relaxConfig";
import MediaRow from "@/components/relax/MediaRow";
import EndlessMediaRow from "@/components/relax/EndlessMediaRow";
import ImmersivePlayer from "@/components/relax/ImmersivePlayer";
import AddMediaDialog from "@/components/relax/AddMediaDialog";
import TonightsPicks from "@/components/relax/TonightsPicks";
import CinemaPlayer from "@/components/relax/CinemaPlayer";
import { sounds } from "@/hooks/use-sound";
import { toast } from "sonner";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Relax() {
  const [currentUser, setCurrentUser] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [cinemaMovie, setCinemaMovie] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [addCategory, setAddCategory] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === "admin";

  const { data: media = [] } = useQuery({
    queryKey: ["relaxMedia"],
    queryFn: () => base44.entities.RelaxMedia.list("sort_order", 500),
  });

  // Today's 3 daily movies — auto-generate via AI if today's batch doesn't exist.
  const { data: dailyMovies = [], isLoading: dailyLoading } = useQuery({
    queryKey: ["dailyMovies", todayStr()],
    queryFn: async () => {
      const existing = await base44.entities.DailyMovie.filter({ pick_date: todayStr() }, "slot", 3);
      if (existing.length >= 3) return existing;
      const res = await base44.functions.invoke("refreshDailyMovies", {});
      return res?.data?.movies || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  const categoryKeys = useMemo(() => {
    const present = [...new Set(media.map((m) => m.category).filter(Boolean))];
    const defaults = RELAX_CATEGORIES.map((c) => c.key);
    const customs = present.filter((k) => !defaults.includes(k));
    return [...defaults, ...customs];
  }, [media]);

  const byCategory = useMemo(() => {
    const map = {};
    media.forEach((m) => {
      if (!map[m.category]) map[m.category] = [];
      map[m.category].push(m);
    });
    return map;
  }, [media]);

  const openAdd = (category) => { setEditItem(null); setAddCategory(category); setShowAdd(true); };
  const openEdit = (item) => { setEditItem(item); setAddCategory(item.category); setShowAdd(true); };

  const handleDelete = async (item) => {
    if (!confirm(`Remove "${item.title}" from the universe?`)) return;
    try {
      await base44.entities.RelaxMedia.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ["relaxMedia"] });
      toast.success("Removed");
    } catch {
      toast.error("Could not remove");
    }
  };

  const onOpen = (item) => { sounds.click(); setPlaying(item); };
  const onPlayMovie = (movie) => { sounds.click(); setCinemaMovie(movie); };

  const refreshPicks = async () => {
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke("refreshDailyMovies", { force: true });
      queryClient.setQueryData(["dailyMovies", todayStr()], res?.data?.movies || []);
      toast.success("Fresh picks loaded");
    } catch {
      toast.error("Could not refresh picks");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background pb-16">
      {/* Immersive cinema hero — pick 1 of 3 daily public-domain movies */}
      <TonightsPicks
        movies={dailyMovies}
        loading={dailyLoading || refreshing}
        onPlay={onPlayMovie}
        onRefresh={refreshPicks}
        isAdmin={isAdmin}
      />

      {/* Universe intro strip */}
      <div className="px-4 sm:px-8 pt-6 pb-2 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading font-black text-2xl text-gradient-animate inline-block flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> The Entertainment Universe
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Movies, shows, music & more — unwind, get inspired, then jump back into the studio.</p>
        </div>
        {isAdmin && (
          <button onClick={() => openAdd("movies")} className="flex items-center gap-2 bg-gradient-to-r from-primary to-pink-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-all glow-primary">
            <Plus className="w-4 h-4" /> Add Media
          </button>
        )}
      </div>

      <div className="pt-4">
        {categoryKeys.map((key) =>
          key === "movies" || key === "tv" ? (
            <EndlessMediaRow key={key} categoryKey={key} onOpen={onOpen} />
          ) : (
            <MediaRow
              key={key}
              categoryKey={key}
              items={byCategory[key] || []}
              onOpen={onOpen}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAdd={openAdd}
            />
          )
        )}
      </div>

      {cinemaMovie && <CinemaPlayer movie={cinemaMovie} onClose={() => setCinemaMovie(null)} />}
      {playing && <ImmersivePlayer item={playing} onClose={() => setPlaying(null)} />}

      <AddMediaDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        editItem={editItem}
        defaultCategory={addCategory}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["relaxMedia"] })}
      />
    </div>
  );
}