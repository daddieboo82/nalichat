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
  const isAdmin = currentUser?.role === "admin";
  const [funnelWindow, setFunnelWindow] = React.useState("30d");

  const { data: funnelEvents = [] } = useQuery({
    queryKey: ["activationFunnel", currentUser?.id],
    queryFn: async () => isAdmin ? base44.entities.ActivationFunnel.list("-created_date", 500) : [],
    enabled: Boolean(currentUser && isAdmin),
  });

  const filteredFunnelEvents = React.useMemo(() => {
    if (funnelWindow === "all") return funnelEvents;
    const days = funnelWindow === "7d" ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return funnelEvents.filter(event => {
      const created = new Date(event.created_date || event.created_at || 0).getTime();
      return Number.isFinite(created) && created >= cutoff;
    });
  }, [funnelEvents, funnelWindow]);

  const messengerActivation = React.useMemo(() => {
    const countUnique = (name) => new Set(
      filteredFunnelEvents.filter(e => e.event_name === name).map(e => e.user_id || e.session_id || e.id)
    ).size;
    const viewed = countUnique("messenger_discovery_view");
    const added = countUnique("contact_added");
    const messageClicks = countUnique("messenger_discovery_message_click");
    const firstMessages = countUnique("first_message");
    return [
      { label: "Discovery Viewed", count: viewed, rate: 100 },
      { label: "Contact Added", count: added, rate: viewed > 0 ? Math.round((added / viewed) * 100) : 0 },
      { label: "Message Clicked", count: messageClicks, rate: viewed > 0 ? Math.round((messageClicks / viewed) * 100) : 0 },
      { label: "First Message", count: firstMessages, rate: viewed > 0 ? Math.round((firstMessages / viewed) * 100) : 0 },
    ];
  }, [filteredFunnelEvents]);

  const studioActivation = React.useMemo(() => {
    const countUnique = (name) => new Set(
      filteredFunnelEvents.filter(e => e.event_name === name).map(e => e.user_id || e.session_id || e.id)
    ).size;
    const opened = countUnique("studio_open");
    const uploaded = countUnique("first_upload");
    return [
      { label: "Studio Opened", count: opened, rate: 100 },
      { label: "First Audio Import", count: uploaded, rate: opened > 0 ? Math.round((uploaded / opened) * 100) : 0 },
    ];
  }, [filteredFunnelEvents]);

  const funnel = React.useMemo(() => {
    const steps = [
      ["homepage_view", "Homepage"], ["signup_click", "Signup Click"],
      ["registration_started", "Registration Started"], ["registration_completed", "Registered"],
      ["onboarding_complete", "Profile Setup"], ["post_login_action", "Post-login Action"],
      ["activation_complete", "Activated"], ["return_visit", "Return Visit"],
    ];
    const counts = Object.fromEntries(steps.map(([name]) => [name, new Set(
      filteredFunnelEvents.filter(e => e.event_name === name).map(e => e.user_id || e.session_id || e.id)
    ).size]));
    const base = counts.homepage_view || 0;
    return steps.map(([name, label], index) => {
      const count = counts[name] || 0;
      const previousCount = index > 0 ? counts[steps[index - 1][0]] || 0 : 0;
      return {
        name, label, count,
        rate: base > 0 ? Math.round((count / base) * 100) : 0,
        previousRate: index === 0 ? 100 : previousCount > 0 ? Math.round((count / previousCount) * 100) : 0,
        dropoff: index === 0 ? 0 : Math.max(0, previousCount - count),
      };
    });
  }, [filteredFunnelEvents]);

  const premiumConversion = React.useMemo(() => {
    const countUnique = (name) => new Set(
      filteredFunnelEvents.filter(e => e.event_name === name).map(e => e.user_id || e.session_id || e.id)
    ).size;
    const upgrades = countUnique("upgrade_click");
    const checkout = countUnique("checkout_started");
    const purchases = countUnique("purchase_completed");
    return [
      { label: "Upgrade Click", count: upgrades, rate: 100 },
      { label: "Checkout Started", count: checkout, rate: upgrades > 0 ? Math.round((checkout / upgrades) * 100) : 0 },
      { label: "Purchase Confirmed", count: purchases, rate: upgrades > 0 ? Math.round((purchases / upgrades) * 100) : 0 },
    ];
  }, [filteredFunnelEvents]);

  const premiumSources = React.useMemo(() => {
    const labels = {
      desktop_nav: "Desktop nav",
      mobile_header: "Mobile header",
      app_upgrade_banner: "App banner",
      pricing: "Direct pricing",
    };
    const sourceMap = new Map();
    for (const event of filteredFunnelEvents) {
      if (!["upgrade_click", "checkout_started", "purchase_completed"].includes(event.event_name)) continue;
      const source = event.source || "unknown";
      const row = sourceMap.get(source) || { source, clicks: new Set(), checkouts: new Set(), purchases: new Set() };
      const identity = event.user_id || event.session_id || event.id;
      if (event.event_name === "upgrade_click") row.clicks.add(identity);
      if (event.event_name === "checkout_started") row.checkouts.add(identity);
      if (event.event_name === "purchase_completed") row.purchases.add(identity);
      sourceMap.set(source, row);
    }
    return [...sourceMap.values()]
      .map(row => ({
        source: row.source,
        label: labels[row.source] || row.source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        clicks: row.clicks.size,
        checkouts: row.checkouts.size,
        purchases: row.purchases.size,
      }))
      .filter(row => row.clicks || row.checkouts || row.purchases)
      .sort((a, b) => b.purchases - a.purchases || b.checkouts - a.checkouts || b.clicks - a.clicks)
      .slice(0, 8);
  }, [filteredFunnelEvents]);

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
    <PullToRefresh onRefresh={async () => { queryClient.invalidateQueries({ queryKey: ["userAnalytics"] }); }} className="flex h-full flex-col overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-accent/5 px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Track your audience engagement</p>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 px-4 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" aria-live="polite">
            <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Loading analytics</span>
          </div>
        ) : isError ? (
          <div className="ui-surface rounded-3xl border border-destructive/40 bg-card/60 p-6 text-center" role="alert">
            <h2 className="font-heading text-lg font-semibold">Analytics unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't load your release data, so the app won't show misleading zero totals.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="ui-hover mt-4 min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
        {isAdmin && (
          <Card className="ui-surface rounded-3xl border border-primary/20 bg-card/60 p-4 backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold tracking-tight">Visitor Activation Funnel</h2>
                <p className="mt-1 text-sm text-muted-foreground">Unique users or sessions across the latest 500 activation events.</p>
              </div>
              <div className="flex items-center gap-2">
                {[['7d', '7 days'], ['30d', '30 days'], ['all', 'All']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFunnelWindow(value)}
                    className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${funnelWindow === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/50 text-muted-foreground hover:text-foreground'}`}
                  >
                    {label}
                  </button>
                ))}
                <span className="ml-1 text-xs text-muted-foreground">Admin</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {funnel.map((step, index) => (
                <div key={step.name} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                  <p className="mt-2 text-2xl font-heading font-bold tabular-nums">{step.count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {index === 0 ? "Baseline" : `${step.previousRate}% from prior · ${step.rate}% overall`}
                  </p>
                  {index > 0 && step.dropoff > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{step.dropoff} drop-off</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border/60 pt-4">
              <div className="mb-3">
                <h3 className="font-heading text-sm font-semibold">Premium Conversion</h3>
                <p className="mt-1 text-xs text-muted-foreground">See whether upgrade interest is turning into confirmed subscriptions.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {premiumConversion.map((step, index) => (
                  <div key={step.label} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="mt-2 text-xl font-heading font-bold tabular-nums">{step.count}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Baseline" : `${step.rate}% of upgrade clickers`}</p>
                  </div>
                ))}
              </div>
              {premiumSources.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-border/60 bg-background/30">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="border-b border-border/60 text-muted-foreground">
                      <tr><th className="p-3 font-semibold">Upgrade source</th><th className="p-3 font-semibold">Clicks</th><th className="p-3 font-semibold">Checkout</th><th className="p-3 font-semibold">Purchases</th></tr>
                    </thead>
                    <tbody>
                      {premiumSources.map(row => (
                        <tr key={row.source} className="border-b border-border/40 last:border-0">
                          <td className="p-3 font-medium">{row.label}</td><td className="p-3 tabular-nums">{row.clicks}</td><td className="p-3 tabular-nums">{row.checkouts}</td><td className="p-3 font-bold tabular-nums">{row.purchases}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-5 border-t border-border/60 pt-4 lg:grid-cols-2">
              <div>
                <div className="mb-3">
                  <h3 className="font-heading text-sm font-semibold">Messenger Activation</h3>
                  <p className="mt-1 text-xs text-muted-foreground">See whether creator discovery is turning into conversations.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {messengerActivation.map((step, index) => (
                    <div key={step.label} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                      <p className="mt-2 text-xl font-heading font-bold tabular-nums">{step.count}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Baseline" : `${step.rate}% of discovery viewers`}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3">
                  <h3 className="font-heading text-sm font-semibold">Studio Activation</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Measure whether opening Studio turns into importing audio.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {studioActivation.map((step, index) => (
                    <div key={step.label} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                      <p className="mt-2 text-xl font-heading font-bold tabular-nums">{step.count}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Baseline" : `${step.rate}% of Studio openers`}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="ui-surface ui-hover h-full rounded-3xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl hover:border-white/[0.12] hover:bg-card/70 sm:p-5">
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
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Top Tracks */}
          <Card className="ui-surface overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 font-heading font-semibold tracking-tight">Top Tracks by Views</h2>
            {trackData.length > 0 ? (
              <div className="-mx-2 overflow-x-auto px-2"><div className="min-w-[520px]"><ResponsiveContainer width="100%" height={300}>
                <BarChart data={trackData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="views" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer></div></div>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No data yet. Upload tracks to see analytics.</p>
            )}
          </Card>

          {/* Catalog totals by release */}
          <Card className="ui-surface overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 font-heading font-semibold tracking-tight">Catalog Totals by Release</h2>
            {growthData.length > 0 ? (
              <div className="-mx-2 overflow-x-auto px-2"><div className="min-w-[520px]"><ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="track" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="likes" stroke="hsl(var(--accent))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer></div></div>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No data yet. Upload tracks to see analytics.</p>
            )}
          </Card>
        </div>

        {/* Detailed Track List */}
        {userPosts.length > 0 && (
          <Card className="ui-surface overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 font-heading font-semibold tracking-tight">Track Performance</h2>
            <div className="no-scrollbar -mx-1 overflow-x-auto rounded-xl px-1">
              <table className="w-full min-w-[560px] text-sm tabular-nums">
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
                      <tr key={post.id} className="border-b border-border transition-colors hover:bg-secondary/30">
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