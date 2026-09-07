import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Eye, Heart, Music } from "lucide-react";
import { motion } from "framer-motion";
export default function Analytics() {
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: userPosts = [] } = useQuery({
    queryKey: ["userAnalytics", currentUser?.id],
    queryFn: () =>
      currentUser
        ? base44.entities.ArtPost.filter({ creator_id: currentUser.id }, "-created_date", 100)
        : [],
    enabled: !!currentUser,
  });

  // Calculate aggregate stats
  const { totalViews, totalLikes, avgLikesPerTrack, trackData, growthData } = React.useMemo(() => {
    const views = userPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    const likes = userPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const avgLikes = userPosts.length > 0 ? (likes / userPosts.length).toFixed(1) : 0;

    const tData = [...userPosts]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map(p => ({
        name: p.title?.substring(0, 15) || "Untitled",
        views: p.views || 0,
        likes: p.likes || 0,
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
          likes: lastEntry.likes + (post.likes || 0),
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
      <div className="p-6 border-b border-border">
        <h1 className="text-3xl font-heading font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your audience engagement</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-2xl font-heading font-bold mt-2">{stat.value}</p>
                    </div>
                    <Icon className={`w-8 h-8 ${stat.color} opacity-60`} />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Tracks */}
          <Card className="p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06]">
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

          {/* Growth Trend */}
          <Card className="p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06]">
            <h2 className="font-heading font-semibold mb-4">Cumulative Growth</h2>
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
          <Card className="p-5 bg-card/50 backdrop-blur-xl border border-white/[0.06]">
            <h2 className="font-heading font-semibold mb-4">Track Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                    const engagement = post.views > 0 ? ((post.likes / post.views) * 100).toFixed(1) : 0;
                    return (
                      <tr key={post.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-3 truncate max-w-xs">{post.title}</td>
                        <td className="text-center py-3 px-3">{post.views || 0}</td>
                        <td className="text-center py-3 px-3 text-primary font-semibold">{post.likes || 0}</td>
                        <td className="text-center py-3 px-3 text-accent">{engagement}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
}