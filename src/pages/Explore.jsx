import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import ArtPostCard from "@/components/explore/ArtPostCard";
import PullToRefresh from "@/components/layout/PullToRefresh";
import UploadArtDialog from "@/components/explore/UploadArtDialog";
import AddToPlaylistDialog from "@/components/explore/AddToPlaylistDialog";
import TrackCommentsDialog from "@/components/explore/TrackCommentsDialog";
import { sounds } from "@/hooks/use-sound";
import { toast } from "sonner";
import { getLikeCount } from "@/lib/engagement";

const MEDIUMS = ["all", "original", "remix", "cover", "beat", "production", "mixing", "mastering", "collab"];

async function listAllArtPosts(filter) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = filter === "all"
      ? await base44.entities.ArtPost.list("-created_date", pageSize, skip)
      : await base44.entities.ArtPost.filter({ medium: filter }, "-created_date", pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function Explore() {
  const location = useLocation();
  const navigate = useNavigate();
  // Use the already-resolved app-wide auth state instead of a fresh per-page
  // fetch — a local base44.auth.me() call left currentUser null for a brief
  // window on mount, wrongly redirecting logged-in users to login.
  const { user: currentUser, navigateToLogin } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const [filter, setFilter] = useState(urlParams.get("filter") || "all");
  const [search, setSearch] = useState(urlParams.get("search") || "");
  const [showUpload, setShowUpload] = useState(urlParams.get("upload") === "true");
  const [publishFile, setPublishFile] = useState(location.state?.publishFile || null);

  useEffect(() => {
    if (!location.state?.publishFile) return;
    setPublishFile(location.state.publishFile);
    setShowUpload(true);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  // Update URL when search or filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (search) params.set("search", search);
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [filter, search]);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState(null);
  const [commentTrack, setCommentTrack] = useState(null);
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["artposts", filter, currentUser?.id],
    queryFn: async () => {
      const [rows, likedRes] = await Promise.all([
        listAllArtPosts(filter),
        currentUser
          ? base44.functions.invoke("listMyLikedPostIds", {})
          : Promise.resolve({ data: { post_ids: [] } }),
      ]);
      const likedIds = new Set(likedRes?.data?.post_ids || []);
      return rows.map((post) => ({
        ...post,
        liked_by: currentUser && likedIds.has(post.id) ? [currentUser.id] : [],
      }));
    },
  });

  const deletePost = useMutation({
    mutationFn: async (post) => {
      const res = await base44.functions.invoke("deleteArtPost", { postId: post.id });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artposts"] });
      queryClient.invalidateQueries({ queryKey: ["playlistTracks"] });
      queryClient.invalidateQueries({ queryKey: ["myPlaylists"] });
      toast.success("Track deleted");
    },
    onError: () => toast.error("Failed to delete track"),
  });

  const toggleLike = useMutation({
    mutationFn: async (post) => {
      if (!currentUser) return;
      return base44.functions.invoke('toggleLike', { postId: post.id });
    },
    // Optimistic update so the heart + count flip instantly
    onMutate: async (post) => {
      if (!currentUser) return;
      await queryClient.cancelQueries({ queryKey: ["artposts", filter, currentUser?.id] });
      const previous = queryClient.getQueryData(["artposts", filter, currentUser?.id]);
      const update = (old = []) => old.map(p => {
        if (p.id !== post.id) return p;
        const liked = p.liked_by?.includes(currentUser.id);
        const liked_by = liked
          ? p.liked_by.filter(id => id !== currentUser.id)
          : [...(p.liked_by || []), currentUser.id];
        return { ...p, liked_by, likes: liked_by.length };
      });
      queryClient.setQueryData(["artposts", filter, currentUser?.id], update);
      return { previous, filter };
    },
    onError: (_err, _post, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["artposts", ctx.filter, currentUser?.id],
          ctx.previous,
        );
      }
      toast.error("Couldn't update like. Please try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["artposts"] }),
  });

  const filtered = React.useMemo(() => posts.filter(p => {
    const matchesSearch = !search || String(p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.creator_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.genre || '').toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(p.tags) ? p.tags.some(t => String(t || '').toLowerCase().includes(search.toLowerCase())) : false);
    const matchesFilter = filter === "all" || p.medium === filter;
    return matchesSearch && matchesFilter;
  }), [posts, search, filter]);

  const featured = React.useMemo(() => filtered.filter(p => p?.featured || getLikeCount(p) > 5), [filtered]);
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
                  navigateToLogin();
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
                <ArtPostCard key={post.id} post={post} currentUser={currentUser} onLike={() => toggleLike.mutate(post)} onComment={setCommentTrack} onAddToPlaylist={setSelectedTrackForPlaylist} onDelete={() => deletePost.mutate(post)} large />
              ))}
            </div>
          </div>
        )}

        {/* All posts masonry grid */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {search ? `Results for "${search}"${filter !== "all" ? ` in ${filter}` : ""}` : (filter !== "all" ? `${filter}s` : "Recent")}
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-20 text-muted-foreground" role="alert">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-heading font-semibold text-foreground">Couldn&apos;t load tracks</p>
              <p className="text-sm mt-1">Check your connection and try again.</p>
              <button
                onClick={() => refetch()}
                className="mt-4 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-heading font-semibold">No tracks yet</p>
              <p className="text-sm mt-1">Be the first to release your music!</p>
              <button onClick={() => {
                if (!currentUser) {
                  navigateToLogin();
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
                  onDelete={() => deletePost.mutate(post)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <UploadArtDialog sourceFile={publishFile} open={showUpload} onClose={() => { setShowUpload(false); setPublishFile(null); }} currentUser={currentUser} onSuccess={() => {
        setShowUpload(false);
        setPublishFile(null);
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