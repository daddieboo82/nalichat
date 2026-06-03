import { Heart, Eye, Music, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function ArtPostCard({ post, currentUser, onLike, onAddToPlaylist, onComment, large }) {
  const liked = post.liked_by?.includes(currentUser?.id);

  return (
    <div className={cn("break-inside-avoid mb-4 bg-card rounded-2xl overflow-hidden border border-border group hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5", large && "")}>
      {post.image_url && (
        <div className="relative overflow-hidden">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ maxHeight: large ? 280 : 220 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="flex items-center gap-1 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
              <Eye className="w-3 h-3" /> {post.views || 0}
            </span>
          </div>
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
              onClick={() => onComment?.(post)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Comments"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onAddToPlaylist?.(post.id)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Add to playlist"
            >
              <Music className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onLike}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-all shrink-0",
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

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
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
            {post.price > 0 && (
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                ${post.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}