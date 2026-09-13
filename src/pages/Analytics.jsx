import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { TrendingUp, Eye, Heart, Music, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getLikeCount } from "@/lib/engagement";
import { useAuth } from "@/lib/AuthContext";

async function listAllUserPosts(userId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.ArtPost.filter(
      { creator_id: userId },
      "-created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
export default function Analytics() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: userPosts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["userAnalytics", currentUser?.id],
    queryFn: () =>
      currentUser
        ? listAllUserPosts(currentUser.id)
        : [],
    enabled: !!currentUser,
  });

  // Calculate aggregate stats
  const { totalViews, totalLikes, avgLikesPerTrack, trackData, growthData } = React.useMemo(() => {
    const views = userPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    const likes = userPosts.reduce((sum, p) => sum + getLikeCount(p), 0);
    const avgLikes = userPosts.length > 0 ? (likes / userPosts.length).toFixed(1) : 0;

    const tData = [...userPosts]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map(p => ({
        name: p.title?.substring(0, 15) || "Untitled",
        views: p.views || 0,
        likes: getLikeCount(p),
      }));

    const gData = [...userPosts]
      .sort((a, b) => {
        const da = a.created_date && !isNaN(new Date(a.created_date).getTime()) ? new Date(a.created_date).getTime() : 0;
        const db = b.created_date && !isNaN(new Date(b.created_date).getTime()) ? new Date(b.created_date).getTime() : 0;
        return da - db;
      })
      .reduce((acc, post, idx) => {
        const lastEntry = acc[acc.length - 1] || { views: 0, likes: 0 };
        acc.push({
          track: idx + 1,
          views: lastEntry.views + (post.views || 0),
          likes: lastEntry.likes + getLikeCount(post),
        });
        return acc;
      }, [])
      .slice(Math.max(0, userPosts.length - 10));

    return { totalViews: views, totalLikes: likes, avgLikesPerTrack: avgLikes, trackData: tData, growthData: gData };
  }, [userPosts]);

  const statCards = [
    { label: "Total Views", value: totalViews, icon: Eye, color: "text-blue-500" },
    { label: "Total Likes", value: totalLikes, icon: Heart, color: "text-red-500" },
    { label: "Tracks Uploaded", value: userPosts.length, icon: Music, color: "text-primary" },
    { label: "Avg Likes/Track", value: avgLikesPerTrack, icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <PullToRefresh onRefresh={async () => { queryClient.invalidateQueries({ queryKey: ["userAnalytics"] }); }} className="h-full flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-accent/5 px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your audience engagement</p>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" aria-live="polite">
            <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Loading analytics</span>
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-card/60 p-6 text-center" role="alert">
            <h2 className="font-heading text-lg font-semibold">Analytics unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't load your release data, so the app won't show misleading zero totals.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="ui-hover mt-4 min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/50"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="ui-surface ui-hover h-full rounded-2xl p-4 sm:p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-xl sm:text-2xl font-heading font-bold mt-2 tabular-nums">{stat.value}</p>
                    </div>
                    <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${stat.color} opacity-70`} />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Tracks */}
          <Card className="ui-surface rounded-2xl p-4 sm:p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06]">
            <h2 className="font-heading font-semibold mb-4">Top Tracks by Views</h2>
            {trackData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trackData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="views" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No data yet. Upload tracks to see analytics.</p>
            )}
          </Card>

          {/* Catalog totals by release */}
          <Card className="ui-surface rounded-2xl p-4 sm:p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06]">
            <h2 className="font-heading font-semibold mb-4">Catalog Totals by Release</h2>
            {growthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="track" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="likes" stroke="hsl(var(--accent))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No data yet. Upload tracks to see analytics.</p>
            )}
          </Card>
        </div>

        {/* Detailed Track List */}
        {userPosts.length > 0 && (
          <Card className="ui-surface rounded-2xl p-4 sm:p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06]">
            <h2 className="font-heading font-semibold mb-4">Track Performance</h2>
            <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Track</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Views</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Likes</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {userPosts.map((post) => {
                    const likeCount = getLikeCount(post);
                    const engagement = post.views > 0 ? ((likeCount / post.views) * 100).toFixed(1) : 0;
                    return (
                      <tr key={post.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-3 truncate max-w-xs">{post.title}</td>
                        <td className="text-center py-3 px-3">{post.views || 0}</td>
                        <td className="text-center py-3 px-3 text-primary font-semibold">{likeCount}</td>
                        <td className="text-center py-3 px-3 text-accent">{engagement}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}