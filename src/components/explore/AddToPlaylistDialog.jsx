import { useEffect, useRef, useState } from "react";
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
import { useAuth } from "@/lib/AuthContext";

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

export default function AddToPlaylistDialog({ trackId, open, onOpenChange }) {
  const { user: currentUser } = useAuth();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef(currentUser?.id || null);
  const identityGenerationRef = useRef(0);

  useEffect(() => {
    const nextUserId = currentUser?.id || null;
    if (lastUserIdRef.current === nextUserId) return;
    lastUserIdRef.current = nextUserId;
    identityGenerationRef.current += 1;
    setNewPlaylistName("");
    onOpenChange(false);
  }, [currentUser?.id, onOpenChange]);

  const { data: playlists = [], isLoading: playlistsLoading, isError: playlistsError, refetch: refetchPlaylists } = useQuery({
    queryKey: ["userPlaylists", currentUser?.id],
    queryFn: () =>
      currentUser
        ? listAllOwnedPlaylists(currentUser.id)
        : [],
    enabled: !!currentUser && open,
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId) => {
      const generation = identityGenerationRef.current;
      const res = await base44.functions.invoke("mutatePlaylist", {
        action: "add_track",
        playlistId,
        trackId,
      });
      if (generation !== identityGenerationRef.current) return { stale: true };
      if (res?.data?.error) throw new Error(res.data.error);
      const playlist = res?.data?.playlist;
      if (res?.data?.success !== true || !playlist?.id || !Array.isArray(playlist.track_ids) || !playlist.track_ids.includes(trackId)) {
        throw new Error("Playlist update was not confirmed.");
      }
      return { stale: false, playlist };
    },
    onSuccess: (result) => {
      if (result?.stale) return;
      const playlist = result?.playlist;
      queryClient.invalidateQueries({ queryKey: ["userPlaylists"] });
      toast.success(`Added to "${playlist.name}"`);
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't add to playlist. Please try again."),
  });

  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      const generation = identityGenerationRef.current;
      const created = await base44.functions.invoke("createPlaylist", {
        name: newPlaylistName,
        track_ids: [trackId],
      });
      if (generation !== identityGenerationRef.current) return { stale: true };
      if (created?.data?.error) throw new Error(created.data.error);
      const playlist = created?.data?.playlist;
      if (created?.data?.success !== true || !playlist?.id || !Array.isArray(playlist.track_ids) || !playlist.track_ids.includes(trackId)) {
        throw new Error("Playlist creation was not confirmed.");
      }
      return { stale: false, playlist };
    },
    onSuccess: (result) => {
      if (result?.stale) return;
      const newPlaylist = result?.playlist;
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
          {playlistsLoading && (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading playlists…</div>
          )}
          {playlistsError && !playlistsLoading && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-center" role="alert">
              <p className="text-sm font-semibold">Couldn't load your playlists</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void refetchPlaylists()}>
                Retry
              </Button>
            </div>
          )}
          {/* Existing Playlists */}
          {!playlistsLoading && !playlistsError && playlists.length > 0 && (
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
          {!playlistsLoading && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}