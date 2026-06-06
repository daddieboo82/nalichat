import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { RELAX_CATEGORIES, getCategoryMeta } from "@/lib/relaxConfig";
import RelaxHero from "@/components/relax/RelaxHero";
import MediaRow from "@/components/relax/MediaRow";
import EndlessMediaRow from "@/components/relax/EndlessMediaRow";
import ImmersivePlayer from "@/components/relax/ImmersivePlayer";
import AddMediaDialog from "@/components/relax/AddMediaDialog";
import { sounds } from "@/hooks/use-sound";
import { toast } from "sonner";

export default function Relax() {
  const [currentUser, setCurrentUser] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [addCategory, setAddCategory] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === "admin";

  const { data: media = [] } = useQuery({
    queryKey: ["relaxMedia"],
    queryFn: () => base44.entities.RelaxMedia.list("sort_order", 500),
  });

  // Build the ordered list of category rows: defaults first, then any custom
  // categories admins created on the fly.
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

  const featured = useMemo(() => {
    const f = media.find((m) => m.featured);
    return f || media[0] || null;
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

  return (
    <div className="h-full overflow-y-auto bg-background pb-16">
      {featured ? (
        <RelaxHero item={featured} onOpen={onOpen} />
      ) : (
        <div className="relative h-[40vh] min-h-[300px] flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-primary/20 via-background to-accent/15">
          <Sparkles className="w-12 h-12 text-primary mb-4" />
          <h1 className="font-heading font-black text-4xl sm:text-5xl text-gradient-animate">The Relax Universe</h1>
          <p className="text-muted-foreground mt-3 max-w-md">An open world of entertainment to unwind and spark inspiration before you jump back into the studio.</p>
          {isAdmin && (
            <button onClick={() => openAdd("movies")} className="mt-6 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add the first media
            </button>
          )}
        </div>
      )}

      {/* Intro strip */}
      {featured && (
        <div className="px-4 sm:px-8 pt-8 pb-2 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-heading font-black text-2xl text-gradient-animate inline-block">The Relax Universe</h2>
            <p className="text-muted-foreground text-sm mt-1">Unwind, get inspired, then jump back into the studio.</p>
          </div>
          {isAdmin && (
            <button onClick={() => openAdd("movies")} className="flex items-center gap-2 bg-gradient-to-r from-primary to-pink-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-all glow-primary">
              <Plus className="w-4 h-4" /> Add Media
            </button>
          )}
        </div>
      )}

      <div className="pt-6">
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