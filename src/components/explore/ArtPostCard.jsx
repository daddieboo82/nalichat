import { useState } from "react";
import { Heart, Eye, Music, MessageCircle, Play, Pause, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import MediaViewerModal from "./MediaViewerModal";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";
import { sounds } from "@/hooks/use-sound";
import { recordArtPostPlay, recordArtPostView } from "@/lib/trackAnalytics";
import { getLikeCount } from "@/lib/engagement";

import React from "react";

export default React.memo(function ArtPostCard({ post, currentUser, onLike, onAddToPlaylist, onComment, onDelete, large }) {
  const [showMedia, setShowMedia] = useState(false);
  const liked = post.liked_by?.includes(currentUser?.id);
  const audioPlayer = useAudioPlayer();
  const playTrack = audioPlayer?.playTrack;
  const currentTrack = audioPlayer?.currentTrack;
  const isPlaying = audioPlayer?.isPlaying;
  const isActive = currentTrack?.id === post.id;
  
  return (
    <>
      <div 
        role="button"
        tabIndex={0}
        title={`View ${post.title || 'media'}`}
        aria-label={`View ${post.title || 'media'}`}
        className={cn("ui-surface group mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-card/70 hover:shadow-xl hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40", large && "")} 
        onClick={() => {
          setShowMedia(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowMedia(true);
          }
        }}
      >
        {(post.image_url || post.file_url) && (
          <div className="relative overflow-hidden">
            <img
              src={post.image_url || "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=600&auto=format&fit=crop"}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="w-full object-cover transition-transform duration-500 group-hover:scale-105 bg-secondary"
              style={{ maxHeight: large ? 280 : 220 }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=600&auto=format&fit=crop";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="flex items-center gap-1 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
                <Eye className="w-3 h-3" /> {post.views || 0}
              </span>
            </div>
            {post.file_url && (
              <div className={cn("absolute inset-0 flex items-center justify-center transition-opacity duration-300", isActive ? "opacity-100 bg-black/60" : "opacity-0 group-hover:opacity-100 bg-black/40")}>
                <button type="button" aria-label={isActive && isPlaying ? "Pause track" : "Play track"}
                  className="ui-hover flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/30 transition-transform focus-visible:ring-2 focus-visible:ring-white/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive && isPlaying && audioPlayer?.togglePlay) {
                      audioPlayer.togglePlay();
                    } else if (typeof playTrack === 'function') {
                      void recordArtPostPlay(post.id, currentUser?.id);
                      void recordArtPostView(post.id, currentUser?.id);
                      playTrack({
                        id: post.id,
                        title: post.title,
                        creator_name: post.creator_name || "Anonymous",
                        file_url: post.file_url,
                        image_url: post.image_url
                      });
                    }
                  }}
                >
                  {isActive && isPlaying ? <Pause className="w-5 h-5 fill-current text-white" /> : <Play className="w-5 h-5 fill-current text-white ml-1" />}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="p-4">
        <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-sm truncate">{post.title}</h3>
            {post.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.description}</p>
            )}
          </div>
          <div className="flex w-full items-center gap-1 sm:w-auto">
            <button
              onClick={(e) => { e.stopPropagation(); sounds.click(); onComment?.(post); }}
              className="ui-hover flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              title="Comments" aria-label="Open comments"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); sounds.click(); onAddToPlaylist?.(post.id); }}
              className="ui-hover flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              title="Add to playlist" aria-label="Add track to playlist"
            >
              <Music className="w-3.5 h-3.5" />
            </button>
            {currentUser?.id === post.creator_id && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${post.title}"? This cannot be undone.`)) {
                    sounds.error();
                    onDelete(post);
                  }
                }}
                className="ui-hover flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/30"
                title="Delete track"
                aria-label="Delete track"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                onLike?.(e); 
                if (!liked) sounds.like();
                else sounds.click();
              }}
              title="Like"
              aria-label="Like"
              className={cn(
                "ui-hover flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-destructive/30",
                liked
                  ? "bg-destructive/15 text-destructive"
                  : "bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              )}
            >
              <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} />
              <span>{getLikeCount(post)}</span>
            </button>
          </div>
        </div>

        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <Avatar className="w-5 h-5">
            <AvatarImage src={post.creator_avatar} />
            <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{post.creator_name?.[0]}</AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate">{post.creator_name || "Anonymous"}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {post.medium && (
              <span className="text-[10px] capitalize bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                {post.medium}
              </span>
            )}
          </div>
        </div>

      </div>
      </div>

      <MediaViewerModal post={post} open={showMedia} onOpenChange={setShowMedia} onAddToPlaylist={onAddToPlaylist} currentUser={currentUser} />
    </>
  );
});