import { useState } from "react";
import { Heart, Eye, Music, MessageCircle, Play, Pause, ShoppingCart, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import MediaViewerModal from "./MediaViewerModal";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";
import { useCart } from "@/lib/CartContext";
import { toast } from "sonner";
import { sounds } from "@/hooks/use-sound";

import React from "react";

export default React.memo(function ArtPostCard({ post, currentUser, onLike, onAddToPlaylist, onComment, onDelete, large }) {
  const [showMedia, setShowMedia] = useState(false);
  const liked = post.liked_by?.includes(currentUser?.id);
  const audioPlayer = useAudioPlayer();
  const playTrack = audioPlayer?.playTrack;
  const currentTrack = audioPlayer?.currentTrack;
  const isPlaying = audioPlayer?.isPlaying;
  const isActive = currentTrack?.id === post.id;
  
  const cart = useCart();

  return (
    <>
      <div 
        role="button"
        tabIndex={0}
        title={`View ${post.title || 'media'}`}
        aria-label={`View ${post.title || 'media'}`}
        className={cn("break-inside-avoid mb-4 bg-card/50 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/[0.06] group hover:border-white/[0.12] hover:bg-card/70 transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 cursor-pointer", large && "")} 
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
                <div 
                  className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive && isPlaying && audioPlayer?.togglePlay) {
                      audioPlayer.togglePlay();
                    } else if (typeof playTrack === 'function') {
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
                </div>
              </div>
            )}
          </div>
        )}
        <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-sm truncate">{post.title}</h3>
            {post.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); sounds.click(); onComment?.(post); }}
              className="p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Comments"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); sounds.click(); onAddToPlaylist?.(post.id); }}
              className="p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Add to playlist"
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
                className="p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
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
                "flex items-center gap-1 px-2.5 py-2 rounded-full text-xs font-semibold transition-all shrink-0 min-h-[44px]",
                liked
                  ? "bg-destructive/15 text-destructive"
                  : "bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              )}
            >
              <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} />
              <span>{post.likes || 0}</span>
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
            {Number(post.price) > 0 && (
              <button
                onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   sounds.click();
                   if (cart && cart.addToCart) {
                     cart.addToCart({
                       id: post.id,
                       title: post.title,
                       price: Number(post.price),
                       image_url: post.image_url,
                       creator_name: post.creator_name,
                       type: 'stem_license'
                     });
                     toast.success("License added to cart");
                   }
                }}
                title="Buy License"
                className="flex items-center gap-1 bg-gradient-to-r from-primary to-pink-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm shadow-primary/30 hover:opacity-90 active:scale-95 transition-all"
              >
                <ShoppingCart className="w-3 h-3" />
                ${Number(post.price).toFixed(2)}
              </button>
            )}
          </div>
        </div>

      </div>
      </div>

      <MediaViewerModal post={post} open={showMedia} onOpenChange={setShowMedia} onAddToPlaylist={onAddToPlaylist} currentUser={currentUser} />
    </>
  );
});