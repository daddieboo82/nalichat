import { Zap, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ACHIEVEMENTS = [
  { key: "first_post", title: "First Steps", description: "Share your first artwork", icon: "🎨", xp: 50, category: "creative" },
  { key: "five_posts", title: "Getting Started", description: "Share 5 artworks", icon: "🖼️", xp: 100, category: "creative" },
  { key: "ten_posts", title: "Prolific Creator", description: "Share 10 artworks", icon: "🎭", xp: 200, category: "creative" },
  { key: "first_like", title: "Appreciated", description: "Get your first like", icon: "❤️", xp: 30, category: "social" },
  { key: "fifty_likes", title: "Fan Favorite", description: "Receive 50 likes total", icon: "🔥", xp: 150, category: "social" },
  { key: "first_message", title: "Connector", description: "Send your first message", icon: "💬", xp: 25, category: "social" },
  { key: "level_5", title: "Rising Star", description: "Reach Level 5", icon: "⭐", xp: 100, category: "explorer" },
  { key: "level_10", title: "Veteran", description: "Reach Level 10", icon: "💎", xp: 300, category: "legend" },
  { key: "explorer", title: "Explorer", description: "Visit all sections of the app", icon: "🧭", xp: 75, category: "explorer" },
  { key: "community_builder", title: "Community Builder", description: "Start 3 group chats", icon: "👥", xp: 100, category: "social" },
];

const CATEGORY_COLORS = {
  creative: "text-purple-400 bg-purple-400/10",
  social: "text-pink-400 bg-pink-400/10",
  explorer: "text-blue-400 bg-blue-400/10",
  legend: "text-yellow-400 bg-yellow-400/10",
};

export default function AchievementsPanel({ achievements, userId }) {
  const earnedKeys = new Set(achievements.map(a => a.key));

  return (
    <div className="space-y-3 mb-8">
      <p className="text-xs text-muted-foreground mb-4">{achievements.length} / {ALL_ACHIEVEMENTS.length} unlocked</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_ACHIEVEMENTS.map(ach => {
          const earned = earnedKeys.has(ach.key);
          return (
            <div
              key={ach.key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                earned ? "border-border bg-card" : "border-border/30 bg-card/30 opacity-50"
              )}
            >
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0", earned ? CATEGORY_COLORS[ach.category] : "bg-secondary/50")}>
                {earned ? ach.icon : <Lock className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-semibold text-sm", !earned && "text-muted-foreground")}>{ach.title}</p>
                <p className="text-xs text-muted-foreground truncate">{ach.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-yellow-400 shrink-0">
                <Zap className="w-3 h-3" />
                <span>{ach.xp}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}