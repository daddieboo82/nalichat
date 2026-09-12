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

export default function Playlists() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setShowCreateDialog(false);
    setFormData({ name: "", description: "" });
  }, [currentUser?.id]);

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["playlists", currentUser?.id],
    queryFn: () =>
      currentUser
        ? base44.entities.Playlist.filter({ owner_id: currentUser.id }, "-created_date")
        : [],
    enabled: !!currentUser,
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (data) => {
      const created = await base44.functions.invoke("createPlaylist", data);
      if (created?.data?.error) throw new Error(created.data.error);
      return created?.data?.playlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setShowCreateDialog(false);
      setFormData({ name: "", description: "" });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (playlistId) => {
      const res = await base44.functions.invoke("mutatePlaylist", {
        action: "delete",
        playlistId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-20 border-b border-border flex items-center justify-between px-6 shrink-0">
        <h1 className="text-2xl font-heading font-bold">Your Playlists</h1>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Playlist
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <PullToRefresh onRefresh={handleRefresh}>
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Music className="w-10 h-10 text-primary/40" />
            </div>
            <p className="text-center">
              No playlists yet. Create one to start organizing your favorite tracks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className="group bg-card/50 backdrop-blur-xl border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] hover:bg-card/70 transition-all duration-300 cursor-pointer"
              >
                <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
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
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
        <DialogContent>
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
                className="mt-1"
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
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
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