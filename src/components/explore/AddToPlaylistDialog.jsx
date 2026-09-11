import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AddToPlaylistDialog({ trackId, open, onOpenChange }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: playlists = [] } = useQuery({
    queryKey: ["userPlaylists", currentUser?.id],
    queryFn: () =>
      currentUser
        ? base44.entities.Playlist.filter({ owner_id: currentUser.id })
        : [],
    enabled: !!currentUser && open,
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId) => {
      const playlist = await base44.entities.Playlist.get(playlistId);
      const updatedTrackIds = [
        ...new Set([...(playlist.track_ids || []), trackId]),
      ];
      await base44.entities.Playlist.update(playlistId, {
        track_ids: updatedTrackIds,
      });
      return playlist;
    },
    onSuccess: (playlist) => {
      queryClient.invalidateQueries({ queryKey: ["userPlaylists"] });
      toast.success(`Added to "${playlist.name}"`);
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't add to playlist. Please try again."),
  });

  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      const created = await base44.functions.invoke("createPlaylist", {
        name: newPlaylistName,
        track_ids: [trackId],
      });
      if (created?.data?.error) throw new Error(created.data.error);
      return created?.data?.playlist;
    },
    onSuccess: (newPlaylist) => {
      queryClient.invalidateQueries({ queryKey: ["userPlaylists"] });
      toast.success(`Created "${newPlaylist.name}" and added the track`);
      setNewPlaylistName("");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't create playlist. Please try again."),
  });

  const isInPlaylist = (playlistId) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    return playlist?.track_ids?.includes(trackId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
          <DialogDescription>
            Select a playlist or create a new one
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* Existing Playlists */}
          {playlists.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                YOUR PLAYLISTS
              </p>
              {playlists.map((playlist) => {
                const inPlaylist = isInPlaylist(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => !inPlaylist && addToPlaylistMutation.mutate(playlist.id)}
                    disabled={inPlaylist || addToPlaylistMutation.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{playlist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {playlist.track_ids?.length || 0} tracks
                      </p>
                    </div>
                    {inPlaylist && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Create New */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              CREATE NEW
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
              />
              <Button
                onClick={() => createAndAddMutation.mutate()}
                disabled={
                  !newPlaylistName.trim() || createAndAddMutation.isPending
                }
                size="sm"
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}