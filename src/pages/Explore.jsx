import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Eye, Plus, Upload, X, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ArtPostCard from "@/components/explore/ArtPostCard";
import PullToRefresh from "@/components/layout/PullToRefresh";
import UploadArtDialog from "@/components/explore/UploadArtDialog";
import AddToPlaylistDialog from "@/components/explore/AddToPlaylistDialog";
import TrackCommentsDialog from "@/components/explore/TrackCommentsDialog";

const MEDIUMS = ["all", "original", "remix", "cover", "beat", "production", "mixing", "mastering", "collab"];

export default function Explore() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState(null);
  const [commentTrack, setCommentTrack] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const { data: posts = [] } = useQuery({
    queryKey: ["artposts", filter],
    queryFn: () => filter === "all"
      ? base44.entities.ArtPost.list("-created_date", 100)
      : base44.entities.ArtPost.filter({ medium: filter }, "-created_date", 100),
    refetchInterval: 30000,
  });

  const toggleLike = useMutation({
    mutationFn: async (post) => {
      if (!currentUser) return;
      const liked = post.liked_by?.includes(currentUser.id);
      const liked_by = liked
        ? post.liked_by.filter(id => id !== currentUser.id)
        : [...(post.liked_by || []), currentUser.id];
      return base44.entities.ArtPost.update(post.id, { liked_by, likes: liked_by.length });
    },
    // Optimistic update so the heart + count flip instantly
    onMutate: async (post) => {
      if (!currentUser) return;
      await queryClient.cancelQueries({ queryKey: ["artposts", filter] });
      const previous = queryClient.getQueryData(["artposts", filter]);
      const update = (old = []) => old.map(p => {
        if (p.id !== post.id) return p;
        const liked = p.liked_by?.includes(currentUser.id);
        const liked_by = liked
          ? p.liked_by.filter(id => id !== currentUser.id)
          : [...(p.liked_by || []), currentUser.id];
        return { ...p, liked_by, likes: liked_by.length };
      });
      queryClient.setQueryData(["artposts", filter], update);
      return { previous, filter };
    },
    onError: (_err, _post, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["artposts", ctx.filter], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["artposts"] }),
  });

  const filtered = posts.filter(p =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.creator_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const featured = filtered.filter(p => p.featured || p.likes > 5);
  const recent = filtered;

  return (
    <PullToRefresh
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ["artposts"] })}
      className="h-full overflow-y-auto bg-background"
    >
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/30 via-background to-accent/20 px-4 sm:px-8 pt-8 pb-8">
        <div className="absolute -top-24 right-10 w-72 h-72 bg-pink-500/25 rounded-full blur-3xl animate-float-blob pointer-events-none" />
        <div className="absolute -bottom-24 left-10 w-72 h-72 bg-accent/25 rounded-full blur-3xl animate-float-blob pointer-events-none" style={{ animationDelay: "-7s" }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <span className="text-xs text-primary font-bold uppercase tracking-wider">🎵 Discovery Hub</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-black text-gradient-animate inline-block">Discover & Collaborate</h1>
              <p className="text-muted-foreground text-base mt-2">Find inspiring tracks, connect with producers, or release your own work</p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-pink-500 text-white px-5 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/40 transition-all glow-primary shimmer-hover hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Release Your Track
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, artist, tag..."
              className="w-full bg-secondary/60 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
        {/* Medium filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {MEDIUMS.map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap capitalize transition-colors shrink-0",
                filter === m ? "bg-gradient-to-r from-primary to-pink-500 text-white shadow-md shadow-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "all" ? "✨ All" : m}
            </button>
          ))}
        </div>

        {/* Featured row */}
        {featured.length > 0 && search === "" && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-2xl">🔥</div>
              <h2 className="text-lg font-bold tracking-tight">Trending Now</h2>
              <div className="flex-1 h-0.5 bg-gradient-to-r from-primary/40 to-transparent rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.slice(0, 3).map(post => (
                <ArtPostCard key={post.id} post={post} currentUser={currentUser} onLike={() => toggleLike.mutate(post)} onComment={setCommentTrack} onAddToPlaylist={setSelectedTrackForPlaylist} large />
              ))}
            </div>
          </div>
        )}

        {/* All posts masonry grid */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            {search && <span className="text-base">🔍</span>}
            <h2 className="text-lg font-bold tracking-tight">
              {search ? `Results for "${search}"` : "Latest Releases"}
            </h2>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <p className="font-heading font-bold text-lg text-foreground">No tracks yet</p>
              <p className="text-sm mt-2 mb-6">Be the first to release your music and inspire the community!</p>
              <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-pink-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/40 transition-all glow-primary hover:-translate-y-0.5">
                <Plus className="w-4 h-4" />
                Release Your First Track
              </button>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {recent.map(post => (
                <ArtPostCard 
                  key={post.id} 
                  post={post} 
                  currentUser={currentUser} 
                  onLike={() => toggleLike.mutate(post)}
                  onAddToPlaylist={setSelectedTrackForPlaylist}
                  onComment={setCommentTrack}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <UploadArtDialog open={showUpload} onClose={() => setShowUpload(false)} currentUser={currentUser} onSuccess={() => {
        setShowUpload(false);
        queryClient.invalidateQueries({ queryKey: ["artposts"] });
      }} />

      <AddToPlaylistDialog 
        trackId={selectedTrackForPlaylist}
        open={!!selectedTrackForPlaylist}
        onOpenChange={(open) => !open && setSelectedTrackForPlaylist(null)}
      />

      <TrackCommentsDialog
        post={commentTrack}
        currentUser={currentUser}
        open={!!commentTrack}
        onOpenChange={(open) => !open && setCommentTrack(null)}
      />
    </PullToRefresh>
  );
}