import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Star, Flame, Heart, Award, Crown, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TABS = ["xp", "likes", "posts"];

export default function Leaderboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState("xp");

  useEffect(() => { base44.auth.me().then(setCurrentUser); }, []);

  const { data: users = [] } = useQuery({
    queryKey: ["leaderboard-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["leaderboard-posts"],
    queryFn: () => base44.entities.ArtPost.list("-likes", 200),
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["all-achievements"],
    queryFn: () => base44.entities.Achievement.list(),
  });

  const postCountByUser = {};
  const likesCountByUser = {};
  posts.forEach(p => {
    postCountByUser[p.creator_id] = (postCountByUser[p.creator_id] || 0) + 1;
    likesCountByUser[p.creator_id] = (likesCountByUser[p.creator_id] || 0) + (p.likes || 0);
  });

  const achievementCountByUser = {};
  achievements.forEach(a => {
    achievementCountByUser[a.user_id] = (achievementCountByUser[a.user_id] || 0) + 1;
  });

  const sorted = [...users].sort((a, b) => {
    if (tab === "xp") return (b.xp || 0) - (a.xp || 0);
    if (tab === "likes") return (likesCountByUser[b.id] || 0) - (likesCountByUser[a.id] || 0);
    if (tab === "posts") return (postCountByUser[b.id] || 0) - (postCountByUser[a.id] || 0);
    return 0;
  }).slice(0, 50);

  const getValue = (user) => {
    if (tab === "xp") return `${user.xp || 0} XP`;
    if (tab === "likes") return `${likesCountByUser[user.id] || 0} ❤️`;
    if (tab === "posts") return `${postCountByUser[user.id] || 0} posts`;
  };

  const myRank = sorted.findIndex(u => u.id === currentUser?.id) + 1;

  const RANK_ICONS = [
    <Crown className="w-5 h-5 text-yellow-400" />,
    <Medal className="w-5 h-5 text-slate-300" />,
    <Medal className="w-5 h-5 text-amber-600" />,
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500/10 via-background to-primary/10 px-4 sm:px-8 pt-8 pb-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">Leaderboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Top creators on ArtVerse</p>
          {myRank > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold">
              <Star className="w-4 h-4" /> You're #{myRank}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 bg-secondary/50 rounded-xl p-1 mb-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors",
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "xp" ? "⚡ XP" : t === "likes" ? "❤️ Likes" : "🎨 Posts"}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {sorted.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            {[sorted[1], sorted[0], sorted[2]].map((user, i) => {
              const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <div key={user.id} className={cn("flex flex-col items-center gap-2", realRank === 1 ? "mb-0" : "mb-2")}>
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
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                user.id === currentUser?.id ? "border-primary/40 bg-primary/5" : "border-border bg-card/60 hover:bg-card"
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
      </div>
    </div>
  );
}