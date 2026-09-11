import { Star, Music, Headphones, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLikeCount } from "@/lib/engagement";

export default function TopWorksGallery({ posts }) {
  // Sort by likes + views (engagement metric)
  const topWorks = posts
    .sort((a, b) => (getLikeCount(b) + (b.views || 0)) - (getLikeCount(a) + (a.views || 0)))
    .slice(0, 12);

  if (topWorks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="font-heading font-semibold">No featured tracks yet</p>
        <p className="text-sm mt-1">Release tracks to build your gallery</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Star className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-lg">Featured Works</h2>
          <p className="text-xs text-muted-foreground">Your most popular tracks</p>
        </div>
      </div>

      {/* Masonry Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topWorks.map((post, i) => (
          <div
            key={post.id}
            className={cn(
              "group relative rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer",
              i === 0 && "md:col-span-2 lg:col-span-2 md:row-span-2 lg:row-span-2"
            )}
          >
            {/* Image */}
            <div className="relative overflow-hidden bg-secondary aspect-video md:aspect-square lg:aspect-auto lg:h-80">
              {post.image_url ? (
                <img
                  src={post.image_url}
                  alt={post.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                  <Music className="w-12 h-12 text-primary/40" />
                </div>
              )}
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Title */}
              <h3 className="font-heading font-bold text-sm line-clamp-2 mb-1.5">
                {post.title}
              </h3>

              {/* Medium badge */}
              {post.medium && (
                <div className="mb-2 flex items-center gap-1">
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full capitalize font-medium">
                    {post.medium}
                  </span>
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-accent" />
                  <span className="font-medium">{getLikeCount(post)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{post.views || 0} views</span>
                </div>
              </div>

              {/* Genre & BPM if available */}
              {(post.genre || post.bpm) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {post.genre && (
                    <span className="text-[9px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded">
                      {post.genre}
                    </span>
                  )}
                  {post.bpm && (
                    <span className="text-[9px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded">
                      {post.bpm} BPM
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Premium indicator for top track */}
            {i === 0 && (
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur text-white px-3 py-1.5 rounded-full">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-semibold">Top</span>
              </div>
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
              <button className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}