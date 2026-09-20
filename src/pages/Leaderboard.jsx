import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Star, Heart, Award, Crown, Medal, Music, Image as ImageIcon, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MediaViewerModal from "@/components/explore/MediaViewerModal";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { getLikeCount } from "@/lib/engagement";
import { useAuth } from "@/lib/AuthContext";

const USER_TABS = ["xp", "likes", "posts", "achievements", "viral"];
const CONTENT_TABS = ["songs"];

async function listAllArtPosts() {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.ArtPost.list("-created_date", pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [mode, setMode] = useState("users");
  const [userTab, setUserTab] = useState("xp");
  const [contentTab, setContentTab] = useState("songs");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);


  const { data: users = [], isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["leaderboard-users", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("listPublicUsers", { includeAchievementCounts: true });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.viewerUserId !== currentUser?.id ||
        res?.data?.requestedUserId !== null ||
        !Array.isArray(res?.data?.users)
      ) {
        throw new Error("Leaderboard user response was not confirmed.");
      }
      return res.data.users;
    },
  });

  const { data: posts = [], isLoading: postsLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ["leaderboard-posts"],
    queryFn: listAllArtPosts,
  });



  const postCountByUser = {};
  const likesCountByUser = {};
  posts.forEach(p => {
    postCountByUser[p.creator_id] = (postCountByUser[p.creator_id] || 0) + 1;
    likesCountByUser[p.creator_id] = (likesCountByUser[p.creator_id] || 0) + getLikeCount(p);
  });

  const achievementCountByUser = Object.fromEntries(
    users.map((user) => [user.id, Number(user.achievement_count || 0)])
  );

  const sorted = [...users].sort((a, b) => {
    if (userTab === "xp") return (b.xp || 0) - (a.xp || 0);
    if (userTab === "likes") return (likesCountByUser[b.id] || 0) - (likesCountByUser[a.id] || 0);
    if (userTab === "posts") return (postCountByUser[b.id] || 0) - (postCountByUser[a.id] || 0);
    if (userTab === "achievements") return (b.achievement_count || 0) - (a.achievement_count || 0);
    if (userTab === "viral") return (b.viral_concepts_generated || 0) - (a.viral_concepts_generated || 0);
    return 0;
  }).slice(0, 50);

  const getValue = (user) => {
    if (userTab === "xp") return `${user.xp || 0} XP`;
    if (userTab === "likes") return `${likesCountByUser[user.id] || 0} ❤️`;
    if (userTab === "posts") return `${postCountByUser[user.id] || 0} posts`;
    if (userTab === "achievements") return `${user.achievement_count || 0} 🏆`;
    if (userTab === "viral") return `${user.viral_concepts_generated || 0} 🚀`;
  };

  const topSongs = [...posts].sort((a, b) => getLikeCount(b) - getLikeCount(a)).slice(0, 20);

  const getCurrentContentList = () => {
    if (contentTab === "songs") return topSongs;
    return [];
  };

  const currentContent = getCurrentContentList();

  const needsPostsForUserTab = userTab === "likes" || userTab === "posts";
  const leaderboardLoading = mode === "content"
    ? postsLoading
    : usersLoading || (needsPostsForUserTab && postsLoading);
  const leaderboardLoadProblem = mode === "content"
    ? postsError
    : usersError || (needsPostsForUserTab && postsError);

  const handleItemClick = (item) => {
    setSelectedItem({
      ...item,
      title: item.title || item.name || "Untitled",
      creator_name: item.creator_name || item.uploader_name || "Unknown",
      creator_avatar: item.creator_avatar || null,
      image_url: item.image_url || (item.file_type === 'image' ? item.file_url : null),
      file_url: item.file_url,
    });
    setIsViewerOpen(true);
  };

  const myRank = sorted.findIndex(u => u.id === currentUser?.id) + 1;

  const RANK_ICONS = [
    <Crown className="w-5 h-5 text-yellow-400" />,
    <Medal className="w-5 h-5 text-slate-300" />,
    <Medal className="w-5 h-5 text-amber-600" />,
  ];

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leaderboard-users"] });
    await queryClient.invalidateQueries({ queryKey: ["leaderboard-posts"] });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto custom-scrollbar touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
      <PullToRefresh onRefresh={handleRefresh}>
      {/* Header */}
      <div className="border-b border-border/60 bg-gradient-to-br from-yellow-500/10 via-background to-primary/10 px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-500/20 shadow-lg shadow-yellow-500/10">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Leaderboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Top creators across NaliChat</p>
          {myRank > 0 && (
            <div className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Star className="w-4 h-4" /> You're #{myRank}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-6 lg:pb-8">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex w-full max-w-sm gap-1 rounded-2xl bg-secondary/50 p-1.5">
            <button
              onClick={() => setMode("users")}
              className={cn("ui-hover min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/40", mode === "users" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}
            >
              Top Users
            </button>
            <button
              onClick={() => setMode("content")}
              className={cn("ui-hover min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/40", mode === "content" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}
            >
              Top Content
            </button>
          </div>
        </div>

        {leaderboardLoading && (
          <div className="flex justify-center py-16" aria-live="polite">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="sr-only">Loading leaderboard</span>
          </div>
        )}

        {leaderboardLoadProblem && !leaderboardLoading && (
          <div className="ui-surface rounded-3xl border border-destructive/40 bg-card/60 p-6 text-center" role="alert">
            <p className="font-heading font-semibold">Leaderboard unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">We couldn't load the data needed for this ranking.</p>
            <button
              type="button"
              onClick={() => {
                if (usersError) void refetchUsers();
                if (postsError) void refetchPosts();
              }}
              className="ui-hover mt-4 min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Retry
            </button>
          </div>
        )}

        {!leaderboardLoading && !leaderboardLoadProblem && mode === "users" && (
          <>
            {/* User Tabs */}
            <div className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto rounded-2xl bg-secondary/30 p-1.5">
              {USER_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setUserTab(t)}
                  className={cn(
                    "ui-hover min-h-11 shrink-0 flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    userTab === t ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "xp" ? "⚡ XP" : t === "likes" ? "❤️ Likes" : t === "posts" ? "🎨 Posts" : t === "achievements" ? "🏆 Awards" : "🚀 Viral"}
                </button>
              ))}
            </div>

            {/* Top 3 podium */}
            {sorted.length >= 3 && (
          <div className="no-scrollbar -mx-2 mb-8 flex items-end justify-start gap-2 overflow-x-auto px-2 pb-1 min-[430px]:justify-center sm:gap-3">
            {[sorted[1], sorted[0], sorted[2]].map((user, i) => {
              const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <div key={user.id} className="flex shrink-0 flex-col items-center gap-2">
                  <div className={cn("relative", realRank === 1 && "-mt-4")}>
                    <Avatar className={cn("border-4", realRank === 1 ? "w-16 h-16 border-yellow-400" : realRank === 2 ? "w-12 h-12 border-slate-400" : "w-12 h-12 border-amber-600")}>
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">{user.display_name?.[0] || user.full_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-2 -right-1">{RANK_ICONS[realRank - 1]}</div>
                  </div>
                  <div className={cn("rounded-t-xl px-3 pt-2 text-center w-20 sm:w-24",
                    realRank === 1 ? "bg-yellow-500/20 h-20" : realRank === 2 ? "bg-slate-500/20 h-14" : "bg-amber-700/20 h-10"
                  )}>
                    <p className="text-[10px] font-bold truncate">{user.display_name || user.full_name}</p>
                    <p className="text-[9px] text-muted-foreground">{getValue(user)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="space-y-2">
          {sorted.map((user, i) => (
            <button
              type="button"
              key={user.id}
              onClick={() => navigate(`/profile?id=${user.id}`)}
              className={cn(
                "ui-surface ui-hover flex min-h-[72px] w-full cursor-pointer items-center gap-3 rounded-3xl border p-3 text-left transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/40",
                user.id === currentUser?.id ? "border-primary/40 bg-primary/5" : "border-white/[0.06] bg-card/50 backdrop-blur-xl hover:bg-card/70 hover:border-white/[0.12]"
              )}
            >
              <div className="w-7 text-center shrink-0">
                {i < 3 ? RANK_ICONS[i] : <span className="text-sm text-muted-foreground font-bold">#{i + 1}</span>}
              </div>
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{user.display_name?.[0] || user.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {user.display_name || user.full_name}
                  {user.id === currentUser?.id && <span className="text-primary ml-1 text-xs">(you)</span>}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize">{user.artist_role || "Creator"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                {achievementCountByUser[user.id] > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    <Award className="w-3 h-3" /> {achievementCountByUser[user.id]}
                  </span>
                )}
                <span className="whitespace-nowrap text-xs font-bold text-primary sm:text-sm">{getValue(user)}</span>
              </div>
            </button>
          ))}
        </div>
          </>
        )}

        {!leaderboardLoading && !leaderboardLoadProblem && mode === "content" && (
          <>
            <div className="mb-6 flex gap-2 rounded-2xl bg-secondary/30 p-1.5">
              {CONTENT_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setContentTab(t)}
                  className={cn(
                    "ui-hover flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold capitalize transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    contentTab === t ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "songs" && <Music className="w-4 h-4" />}
                  {t === "pics" && <ImageIcon className="w-4 h-4" />}
                  {t === "videos" && <Video className="w-4 h-4" />}
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {currentContent.length === 0 ? (
                <div className="ui-surface rounded-3xl border border-dashed border-border bg-secondary/20 px-4 py-10 text-center text-muted-foreground">
                  <p className="font-semibold">No {contentTab} uploaded yet.</p>
                  <p className="text-sm">Be the first to upload one!</p>
                </div>
              ) : (
                currentContent.map((item, i) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="ui-surface ui-hover flex min-h-[76px] w-full cursor-pointer items-center gap-3 rounded-3xl border border-white/[0.06] bg-card/50 p-3 text-left backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-primary/40 sm:gap-4"
                  >
                    <div className="w-8 text-center shrink-0 flex flex-col items-center">
                      {i < 3 ? RANK_ICONS[i] : <span className="text-sm text-muted-foreground font-bold">#{i + 1}</span>}
                    </div>
                    
                    {contentTab === "songs" ? (
                      <div className="w-12 h-12 rounded-md bg-secondary shrink-0 overflow-hidden relative border border-border/50">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary"><Music className="w-6 h-6" /></div>
                        )}
                      </div>
                    ) : contentTab === "pics" ? (
                      <div className="w-14 h-14 rounded-md bg-secondary shrink-0 overflow-hidden relative border border-border/50">
                        {item.file_url ? (
                          <img src={item.file_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary"><ImageIcon className="w-6 h-6" /></div>
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-12 rounded-md bg-secondary shrink-0 overflow-hidden relative border border-border/50">
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary relative">
                           {item.file_url ? (
                             <video src={item.file_url} playsInline className="w-full h-full object-cover opacity-50" />
                           ) : null}
                           <Video className="w-6 h-6 absolute" />
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.title || item.name || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        by {item.creator_name || item.uploader_name || "Unknown"}
                      </p>
                    </div>
                    
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1.5 text-primary bg-primary/10 px-2.5 py-1 rounded-full text-xs font-bold">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        {getLikeCount(item)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      
      <MediaViewerModal
        post={selectedItem}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
        currentUser={currentUser}
      />
      </PullToRefresh>
      </div>
    </div>
  );
}