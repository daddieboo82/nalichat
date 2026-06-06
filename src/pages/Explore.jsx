import React, { useState, useEffect } from "react";
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
import { sounds } from "@/hooks/use-sound";

const MEDIUMS = ["all", "original", "remix", "cover", "beat", "production", "mixing", "mastering", "collab"];

export default function Explore() {
  const [currentUser, setCurrentUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const [filter, setFilter] = useState(urlParams.get("filter") || "all");
  const [search, setSearch] = useState(urlParams.get("search") || "");

  // Update URL when search or filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (search) params.set("search", search);
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [filter, search]);
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
      const likes = Math.max(0, (post.likes || 0) + (liked ? -1 : 1));
      return base44.entities.ArtPost.update(post.id, { liked_by, likes });
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
        const likes = Math.max(0, (p.likes || 0) + (liked ? -1 : 1));
        return { ...p, liked_by, likes };
      });
      queryClient.setQueryData(["artposts", filter], update);
      return { previous, filter };
    },
    onError: (_err, _post, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["artposts", ctx.filter], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["artposts"] }),
  });

  const filtered = React.useMemo(() => posts.filter(p =>
    !search || String(p.title || '').toLowerCase().includes(search.toLowerCase()) ||
    String(p.creator_name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(p.genre || '').toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(p.tags) ? p.tags.some(t => String(t || '').toLowerCase().includes(search.toLowerCase())) : false)
  ), [posts, search]);

  const featured = React.useMemo(() => filtered.filter(p => p?.featured || (p?.likes || 0) > 5), [filtered]);
  const recent = filtered;

  return (
    <PullToRefresh
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ["artposts"] })}
      className="h-full overflow-y-auto bg-background"
    >
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/25 via-background to-accent/15 px-4 sm:px-8 pt-8 pb-6">
        <div className="absolute -top-24 right-10 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl animate-float-blob pointer-events-none" />
        <div className="absolute -bottom-24 left-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-float-blob pointer-events-none" style={{ animationDelay: "-7s" }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-xs text-primary font-semibold uppercase tracking-wider">Gallery</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-black text-gradient-animate inline-block">Explore & Discover</h1>
              <p className="text-muted-foreground text-sm mt-1">Tracks from producers worldwide</p>
            </div>
            <button
              onClick={() => {
                if (!currentUser) {
                  base44.auth.redirectToLogin();
                  return;
                }
                setShowUpload(true);
              }}
              title="Release Track"
              aria-label="Release Track"
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-pink-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-all glow-primary shimmer-hover"
            >
              <Plus className="w-4 h-4" />
              Release Track
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="explore-search"
              type="search"
              name="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, artist, tag..."
              title="Search Tracks"
              aria-label="Search Tracks"
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
              onClick={() => { sounds.click(); setFilter(m); }}
              title={`Filter by ${m}`}
              aria-label={`Filter by ${m}`}
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
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">🔥 Trending</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.slice(0, 3).map(post => (
                <ArtPostCard key={post.id} post={post} currentUser={currentUser} onLike={() => toggleLike.mutate(post)} onComment={setCommentTrack} onAddToPlaylist={setSelectedTrackForPlaylist} large />
              ))}
            </div>
          </div>
        )}

        {/* All posts masonry grid */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {search ? `Results for "${search}"` : "Recent"}
          </h2>
          {recent.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-heading font-semibold">No tracks yet</p>
              <p className="text-sm mt-1">Be the first to release your music!</p>
              <button onClick={() => {
                if (!currentUser) {
                  base44.auth.redirectToLogin();
                  return;
                }
                setShowUpload(true);
              }} title="Release Now" aria-label="Release Now" className="mt-4 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                Release Now
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