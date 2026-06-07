import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Pause, X, Volume2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CustomMediaPlayer from "@/components/audio/CustomMediaPlayer";
import { Slider } from "@/components/ui/slider";

export default function PlaylistDetail() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [currentUser, setCurrentUser] = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: playlist, isLoading: playlistLoading } = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => base44.entities.Playlist.get(playlistId),
  });

  const { data: tracks = [], isLoading: tracksLoading } = useQuery({
    queryKey: ["playlistTracks", playlist?.track_ids],
    queryFn: async () => {
      if (!playlist?.track_ids?.length) return [];
      // Tolerate tracks that were deleted from ArtPost — skip the missing ones
      // instead of failing the whole list.
      const results = await Promise.all(
        playlist.track_ids.map((id) =>
          base44.entities.ArtPost.get(id).catch(() => null)
        )
      );
      return results.filter(Boolean);
    },
    enabled: !!playlist?.track_ids?.length,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newPost = await base44.entities.ArtPost.create({
        title: file.name,
        file_url,
        creator_id: currentUser.id,
        creator_name: currentUser.display_name || currentUser.full_name,
        creator_avatar: currentUser.avatar_url,
        medium: "original"
      });
      const updated = {
        ...playlist,
        track_ids: [...(playlist.track_ids || []), newPost.id]
      };
      await base44.entities.Playlist.update(playlistId, {
        track_ids: updated.track_ids
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlistTracks"] });
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
      const updated = {
        ...playlist,
        track_ids: playlist.track_ids.filter((id) => id !== trackId),
      };
      await base44.entities.Playlist.update(playlistId, {
        track_ids: updated.track_ids,
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlistTracks"] });
    },
  });

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const currentTrack = tracks[currentTrackIndex];

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
        {currentUser && (
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTrackMutation.mutate(track.id);
                      }}
                      className="ml-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
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