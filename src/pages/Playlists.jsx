import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Music, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

async function listAllOwnedPlaylists(userId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.Playlist.filter(
      { owner_id: userId },
      "-created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function Playlists() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setShowCreateDialog(false);
    setFormData({ name: "", description: "" });
  }, [currentUser?.id]);

  const { data: playlists = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["playlists", currentUser?.id],
    queryFn: () =>
      currentUser
        ? listAllOwnedPlaylists(currentUser.id)
        : [],
    enabled: !!currentUser,
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (data) => {
      const created = await base44.functions.invoke("createPlaylist", data);
      if (created?.data?.error) throw new Error(created.data.error);
      const playlist = created?.data?.playlist;
      if (created?.data?.success !== true || created?.data?.action !== "create_playlist" || created?.data?.userId !== currentUser?.id || created?.data?.playlistId !== playlist?.id || !playlist?.id) throw new Error("Playlist creation was not confirmed");
      return playlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setShowCreateDialog(false);
      setFormData({ name: "", description: "" });
      toast.success("Playlist created.");
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't create playlist. Please try again.");
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (playlistId) => {
      const res = await base44.functions.invoke("mutatePlaylist", {
        action: "delete",
        playlistId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (res?.data?.success !== true || res?.data?.action !== "delete" || res?.data?.userId !== currentUser?.id || res?.data?.playlistId !== playlistId || res?.data?.deleted !== true) throw new Error("Playlist deletion was not confirmed");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist deleted.");
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't delete playlist. Please try again.");
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    createPlaylistMutation.mutate(formData);
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["playlists"] });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="ui-surface w-full max-w-sm rounded-3xl border border-border bg-card/70 p-6 text-center">
          <h2 className="font-heading text-xl font-bold">Playlists unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">We couldn't load your playlists. Your saved playlists have not been removed.</p>
          <Button className="ui-hover mt-4 min-h-11 rounded-xl" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/70 bg-card/40 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-2xl font-heading font-bold tracking-tight">Your Playlists</h1>
        <Button onClick={() => setShowCreateDialog(true)} className="ui-hover min-h-11 w-full gap-2 rounded-xl font-semibold shadow-lg shadow-primary/10 sm:w-auto">
          <Plus className="w-4 h-4" /> Create Playlist
        </Button></div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
        <PullToRefresh onRefresh={handleRefresh}>
        {playlists.length === 0 ? (
          <div className="ui-surface flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border border-white/[0.06] bg-card/40 p-6 text-muted-foreground">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Music className="w-10 h-10 text-primary/40" />
            </div>
            <p className="text-center">
              No playlists yet. Create one to start organizing your favorite tracks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className="ui-surface ui-hover group cursor-pointer rounded-3xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl hover:border-white/[0.12] hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="mb-4 flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 transition-colors group-hover:from-primary/30 group-hover:to-accent/30">
                  <Music className="w-8 h-8 text-primary/60" />
                </div>
                <h3 className="font-heading font-semibold truncate group-hover:text-primary transition-colors">
                  {playlist.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {playlist.track_ids?.length || 0} tracks
                </p>
                {playlist.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {playlist.description}
                  </p>
                )}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      deletePlaylistMutation.mutate(playlist.id);
                    }}
                    className="ui-hover flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/30" aria-label="Delete playlist"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
        </PullToRefresh>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl border-border bg-card/95 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Create Playlist</DialogTitle>
            <DialogDescription>
              Create a new playlist to organize your favorite music.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Playlist Name</label>
              <Input
                placeholder="My Awesome Mix"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1 h-11 rounded-xl border-border/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                placeholder="Add a description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="mt-1 min-h-[110px] rounded-xl border-border/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="ui-hover min-h-11 rounded-xl"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="ui-hover min-h-11 rounded-xl"
                onClick={handleCreate}
                disabled={!formData.name.trim() || createPlaylistMutation.isPending}
              >
                {createPlaylistMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}