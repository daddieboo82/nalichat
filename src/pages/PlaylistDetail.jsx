import { secureUploadFile } from "@/lib/secureUpload";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Pause, X, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CustomMediaPlayer from "@/components/audio/CustomMediaPlayer";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

export default function PlaylistDetail() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const { user: currentUser } = useAuth();
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: playlist, isLoading: playlistLoading, isError: playlistError, refetch: refetchPlaylist } = useQuery({
    queryKey: ["playlist", currentUser?.id || "anonymous", playlistId],
    queryFn: () => base44.entities.Playlist.get(playlistId),
  });

  const {
    data: trackResult = { tracks: [], unavailableCount: 0 },
    isLoading: tracksLoading,
  } = useQuery({
    queryKey: ["playlistTracks", currentUser?.id || "anonymous", playlist?.track_ids],
    queryFn: async () => {
      if (!playlist?.track_ids?.length) return { tracks: [], unavailableCount: 0 };
      const settled = await Promise.allSettled(
        playlist.track_ids.map((id) => base44.entities.ArtPost.get(id))
      );
      const tracks = settled
        .filter((result) => result.status === "fulfilled" && result.value)
        .map((result) => result.value);
      const unavailableCount = settled.filter((result) => result.status === "rejected").length;
      return { tracks, unavailableCount };
    },
    enabled: !!playlist?.track_ids?.length,
  });
  const tracks = trackResult.tracks;

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await secureUploadFile({ file });
      const published = await base44.functions.invoke("createArtPost", {
        title: file.name,
        file_url,
        medium: "original",
        is_explicit: false,
      });
      if (published?.data?.error) throw new Error(published.data.error);
      const newPost = published?.data?.post;
      if (!newPost?.id) throw new Error("Track was not created");
      try {
        const res = await base44.functions.invoke("mutatePlaylist", {
          action: "add_track",
          playlistId,
          trackId: newPost.id,
        });
        if (res?.data?.error) throw new Error(res.data.error);
        const updatedPlaylist = res?.data?.playlist;
        if (res?.data?.success !== true || !updatedPlaylist?.id) {
          throw new Error("Playlist update was not confirmed");
        }
        return updatedPlaylist;
      } catch (playlistError) {
        // Avoid leaving a newly-published orphan if playlist membership fails.
        try {
          const cleanup = await base44.functions.invoke("deleteArtPost", { postId: newPost.id });
          if (cleanup?.data?.error) throw new Error(cleanup.data.error);
        } catch (cleanupError) {
          const playlistMessage = playlistError instanceof Error
            ? playlistError.message
            : "Could not add track to playlist";
          const cleanupMessage = cleanupError instanceof Error
            ? cleanupError.message
            : "Could not remove the published track";
          throw new Error(
            `${playlistMessage}. The uploaded track was published but rollback failed: ${cleanupMessage}`,
            { cause: playlistError },
          );
        }
        throw playlistError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", currentUser?.id || "anonymous", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlistTracks", currentUser?.id || "anonymous"] });
      toast.success("Track added to playlist.");
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't add track to playlist. Please try again.");
    }
  });

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  const removeTrackMutation = useMutation({
    mutationFn: async (trackId) => {
      const res = await base44.functions.invoke("mutatePlaylist", {
        action: "remove_track",
        playlistId,
        trackId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data?.playlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", currentUser?.id || "anonymous", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlistTracks", currentUser?.id || "anonymous"] });
      toast.success("Track removed from playlist.");
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't remove track from playlist. Please try again.");
    },
  });

  const currentTrack = tracks[currentTrackIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    let cancelled = false;

    if (isPlaying) {
      audio.play().catch(() => {
        if (!cancelled) setIsPlaying(false);
      });
    } else {
      audio.pause();
    }

    return () => {
      cancelled = true;
    };
  }, [isPlaying, currentTrack?.file_url]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTrackIndex(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [playlistId, currentUser?.id]);

  useEffect(() => {
    setCurrentTrackIndex((index) => (
      tracks.length === 0 ? 0 : Math.min(index, tracks.length - 1)
    ));
  }, [tracks.length]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTrackEnd = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleNextTrack = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
      setIsPlaying(true);
    }
  };

  const handlePreviousTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
      setIsPlaying(true);
    }
  };

  if (playlistLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (playlistError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="font-heading text-xl font-bold">Playlist unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">We couldn't load this playlist. It may be a temporary connection problem.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => void refetchPlaylist()}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate("/playlists")}>Back to Playlists</Button>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Playlist not found</p>
        <Button onClick={() => navigate("/playlists")} variant="outline">
          Back to Playlists
        </Button>
      </div>
    );
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-6 shrink-0 gap-3">
        <button
          onClick={() => navigate("/playlists")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-heading font-bold">{playlist.name}</h1>
          <p className="text-xs text-muted-foreground">{tracks.length} tracks</p>
        </div>
        {currentUser?.id === playlist.owner_id && (
          <div className="flex items-center gap-2">
            {uploadMutation.isPending && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            <Input 
              type="file" 
              accept="audio/*" 
              onChange={handleUpload} 
              disabled={uploadMutation.isPending}
              className="w-[200px] cursor-pointer" 
            />
          </div>
        )}
      </div>

      {trackResult.unavailableCount > 0 && !tracksLoading && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300" role="status">
          {trackResult.unavailableCount} playlist track{trackResult.unavailableCount === 1 ? "" : "s"} couldn't be loaded. Showing the tracks that are available.
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 p-6">
        {/* Now Playing */}
        {currentTrack && (
          <div className="lg:w-80 flex flex-col gap-4">
            <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center overflow-hidden">
              {currentTrack.image_url ? (
                <img
                  src={currentTrack.image_url}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20" />
              )}
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg line-clamp-2">
                {currentTrack.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentTrack.creator_name}
              </p>
              {currentTrack.genre && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currentTrack.genre}
                </p>
              )}
            </div>

            {/* Player Controls */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <audio
                ref={audioRef}
                src={currentTrack.file_url}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={handleTrackEnd}
              />

              {/* Progress */}
              <div>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={(value) => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = value[0];
                    }
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={(value) => setVolume(value[0])}
                  className="flex-1"
                />
              </div>

              {/* Play Controls */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousTrack}
                  disabled={currentTrackIndex === 0}
                  className="flex-1"
                >
                  ← Prev
                </Button>
                <Button
                  onClick={handlePlayPause}
                  className="flex-1 gap-2"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Play
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextTrack}
                  disabled={currentTrackIndex === tracks.length - 1}
                  className="flex-1"
                >
                  Next →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            PLAYLIST TRACKS
          </h3>
          {tracksLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tracks in this playlist yet.
            </p>
          ) : (
            <div className="space-y-2">
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  onClick={() => setCurrentTrackIndex(idx)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    idx === currentTrackIndex
                      ? "bg-primary/20 border border-primary"
                      : "bg-card border border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium text-sm truncate ${
                          idx === currentTrackIndex ? "text-primary" : ""
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mb-2">
                        {track.creator_name}
                      </p>
                      {track.file_url && (
                        <CustomMediaPlayer src={track.file_url} className="mt-2" />
                      )}
                    </div>
                    {currentUser?.id === playlist.owner_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackMutation.mutate(track.id);
                        }}
                        className="ml-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}