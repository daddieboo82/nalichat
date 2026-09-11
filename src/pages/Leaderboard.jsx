import { useState, useEffect } from "react";
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

const USER_TABS = ["xp", "likes", "posts", "achievements", "viral"];
const CONTENT_TABS = ["songs"];

export default function Leaderboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [mode, setMode] = useState("users");
  const [userTab, setUserTab] = useState("xp");
  const [contentTab, setContentTab] = useState("songs");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => { base44.auth.me().then(setCurrentUser); }, []);

  const { data: users = [] } = useQuery({
    queryKey: ["leaderboard-users"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listPublicUsers", {});
      return res?.data?.users || [];
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["leaderboard-posts"],
    queryFn: () => base44.entities.ArtPost.list("-created_date", 200),
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
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <PullToRefresh onRefresh={handleRefresh}>
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500/10 via-background to-primary/10 px-4 sm:px-8 pt-8 pb-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">Leaderboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Top producers on RecordStudio</p>
          {myRank > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold">
              <Star className="w-4 h-4" /> You're #{myRank}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-full max-w-sm">
            <button
              onClick={() => setMode("users")}
              className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", mode === "users" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}
            >
              Top Users
            </button>
            <button
              onClick={() => setMode("content")}
              className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", mode === "content" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}
            >
              Top Content
            </button>
          </div>
        </div>

        {mode === "users" && (
          <>
            {/* User Tabs */}
            <div className="flex gap-2 bg-secondary/30 rounded-xl p-1 mb-6">
              {USER_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setUserTab(t)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors",
                    userTab === t ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "xp" ? "⚡ XP" : t === "likes" ? "❤️ Likes" : t === "posts" ? "🎨 Posts" : t === "achievements" ? "🏆 Awards" : "🚀 Viral"}
                </button>
              ))}
            </div>

            {/* Top 3 podium */}
            {sorted.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            {[sorted[1], sorted[0], sorted[2]].map((user, i) => {
              const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <div key={user.id} className="flex flex-col items-center gap-2">
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
            <div
              key={user.id}
              onClick={() => navigate(`/profile?id=${user.id}`)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer",
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
              <div className="flex items-center gap-2 shrink-0">
                {achievementCountByUser[user.id] > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    <Award className="w-3 h-3" /> {achievementCountByUser[user.id]}
                  </span>
                )}
                <span className="text-sm font-bold text-primary">{getValue(user)}</span>
              </div>
            </div>
          ))}
        </div>
          </>
        )}

        {mode === "content" && (
          <>
            <div className="flex gap-2 bg-secondary/30 rounded-xl p-1 mb-6">
              {CONTENT_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setContentTab(t)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors flex items-center justify-center gap-1.5",
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
                <div className="text-center py-10 text-muted-foreground bg-secondary/20 rounded-xl border border-border/50">
                  <p className="font-semibold">No {contentTab} uploaded yet.</p>
                  <p className="text-sm">Be the first to upload one!</p>
                </div>
              ) : (
                currentContent.map((item, i) => (
                  <div 
                    key={item.id} 
                    onClick={() => handleItemClick(item)}
                    className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-xl hover:bg-card/70 hover:border-white/[0.12] transition-all duration-300 cursor-pointer"
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
                    
                    <div className="shrink-0 text-right pr-2">
                      <div className="flex items-center gap-1.5 text-primary bg-primary/10 px-2.5 py-1 rounded-full text-xs font-bold">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        {getLikeCount(item)}
                      </div>
                    </div>
                  </div>
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