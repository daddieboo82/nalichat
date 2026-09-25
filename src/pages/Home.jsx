import { useState, useEffect } from "react";
import { captureMarketingAttribution, getMarketingAttribution } from "@/lib/adAttribution";
import { trackProductEvent } from "@/lib/productAnalytics";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Music, BarChart3, Sparkles,
  Trophy, ArrowRight, Zap, Shield, Star,
  Headphones, Wand2, FileAudio, ChevronRight, UserCircle, Video, Layers, ShoppingCart,
  SlidersHorizontal, Tag, FolderKanban, MapPin, Monitor
} from "lucide-react";
import { motion } from "framer-motion";
import QuickStartGuide from "@/components/home/QuickStartGuide";
import StudioTutorial from "@/components/home/StudioTutorial";
import HowItWorks from "@/components/home/HowItWorks";
import InteractiveWizard from "@/components/onboarding/InteractiveWizard";
import WelcomeTour from "@/components/onboarding/WelcomeTour";

import { sounds } from "@/hooks/use-sound";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/layout/PullToRefresh";
import Logo from "@/components/branding/Logo";
import { getLastVisitedWorld, WORLD_CONTEXTS, WORLD_ORDER } from "@/lib/nalibaseWorldContext";

const PLAZA_WORLD_DETAILS = Object.freeze({
  connect: { subtitle: "NaliChat", description: "Find creators, start chats, update your profile and manage collaborations.", icon: MessageSquare },
  create: { subtitle: "NaliStudio", description: "Record in Studio, capture quick ideas, make cover art and organize playlists.", icon: Music },
  discover: { subtitle: "Creator World", description: "Browse music and creators, follow playlists, rankings and your analytics.", icon: Sparkles },
  share: { subtitle: "Files & Projects", description: "Find files and projects, message collaborators and import into Studio.", icon: FolderKanban },
  visualize: { subtitle: "Music Video Lab", description: "Make cover art and explore visual ideas. Music Video Lab is coming soon.", icon: Video },
  compete: { subtitle: "Challenges", description: "Join or create challenges, check rankings and build a squad.", icon: Trophy },
});

const NALIBASE_OS_URL = 'https://nali-base-os.base44.app';

const PLAZA_WORLDS = WORLD_ORDER.map((id) => ({
  id,
  title: WORLD_CONTEXTS[id].label,
  path: WORLD_CONTEXTS[id].path,
  gradient: WORLD_CONTEXTS[id].plazaGradient,
  action: `enter_${id}`,
  ...PLAZA_WORLD_DETAILS[id],
}));

const features = [
  {
    icon: MessageSquare,
    label: "Unlimited Messages",
    path: "/messages",
    description: "Real-time messaging, unlimited voice notes & high-res file sharing",
    gradient: "from-primary to-pink-500",
    badge: "Included",
  },
  {
    icon: Video,
    label: "Live Jam Rooms",
    path: "/studio",
    description: "Real-time multiplayer Studio co-editing with live audio and video.",
    gradient: "from-accent to-cyan-500",
    badge: "Included",
  },
  {
    icon: Layers,
    label: "AI Stem Engine",
    path: "/studio",
    description: "Instantly separate stems or generate royalty-free background samples on the fly.",
    gradient: "from-indigo-500 to-purple-500",
    badge: "New",
  },
  {
    icon: SlidersHorizontal,
    label: "AI Mastering",
    path: "/studio",
    description: "Automatically master your tracks to industry-standard loudness and clarity.",
    gradient: "from-orange-500 to-red-500",
    badge: "Included",
  },
  {
    icon: FolderKanban,
    label: "Project Management",
    path: "/studio",
    description: "Create projects, organize tracks, set milestones, and manage collaborators & statuses.",
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    icon: Tag,
    label: "AI Tagging",
    path: "/studio",
    description: "Auto-suggest BPM, genre, and key for every track you upload.",
    gradient: "from-fuchsia-500 to-pink-500",
  },
  {
    icon: ShoppingCart,
    label: "Track Discovery",
    path: "/explore",
    description: "Drop your music, discover trending tracks, and connect with other creators.",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: Wand2,
    label: "AI Cover Art",
    path: "/cover-art",
    description: "Generate stunning album covers for your tracks using AI.",
    gradient: "from-yellow-400 to-orange-500",
  },
  {
    icon: Music,
    label: "Playlists",
    path: "/playlists",
    description: "Curate, share, and vibe to your favorite artist collections",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: Trophy,
    label: "Leaderboard",
    path: "/leaderboard",
    description: "Climb rankings & showcase your talent to the world",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: UserCircle,
    label: "Creator Profile",
    path: "/profile",
    description: "Showcase your portfolio, track achievements, and level up.",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: BarChart3,
    label: "Deep Analytics",
    path: "/analytics",
    description: "Track plays, reach, audience growth & listener engagement",
    gradient: "from-cyan-500 to-blue-500",
    badge: "Included",
  },
];

const creatorBenefits = [
  {
    name: "Create",
    role: "Studio workflow",
    avatar: "C",
    color: "from-primary to-pink-500",
    quote: "Record, arrange, mix, master, and export from one connected workspace.",
    metric: "All-in-one",
  },
  {
    name: "Collaborate",
    role: "Messaging + sharing",
    avatar: "C",
    color: "from-yellow-500 to-orange-500",
    quote: "Keep conversations, files, project context, and creative feedback together.",
    metric: "Real-time",
  },
  {
    name: "Grow",
    role: "Creator presence",
    avatar: "G",
    color: "from-accent to-cyan-500",
    quote: "Publish your work, build your profile, organize releases, and track engagement.",
    metric: "Built in",
  },
];

const pillars = [
  { icon: Zap, label: "Real-time collaboration", color: "text-yellow-400" },
  { icon: Shield, label: "Your files, your rights", color: "text-green-400" },
  { icon: Star, label: "Community-driven", color: "text-purple-400" },
  { icon: Headphones, label: "High-quality audio", color: "text-accent" },
  { icon: FileAudio, label: "Multi-format support", color: "text-pink-400" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function Home() {
  const { user: authUser, isAuthenticated, authChecked } = useAuth();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // Only treat as logged-in when both the flag and the user record are present,
  // so the greeting disappears instantly on logout.
  const user = isAuthenticated ? authUser : null;

  // Preserve Google Ads and UTM attribution through the anonymous signup journey.
  useEffect(() => {
    captureMarketingAttribution();
    const attribution = getMarketingAttribution();
    trackProductEvent("homepage_view", {
      authenticated: Boolean(user),
      campaign_source: attribution?.utm_source || undefined,
      campaign_medium: attribution?.utm_medium || undefined,
      campaign_name: attribution?.utm_campaign || undefined,
      campaign_landing_path: attribution?.landing_path || undefined,
    });
  }, []);

  // Auto-show the welcome tour for users who finished onboarding but haven't seen it yet.
  useEffect(() => {
    if (user && user.onboarding_completed && !user.welcome_tour_completed) {
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const lastVisitedWorld = user ? getLastVisitedWorld(user.id) : null;

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries()} className="h-full overflow-auto bg-background">

      {/* — Hero — */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pb-20 pt-[max(5.5rem,env(safe-area-inset-top))] sm:px-6 sm:pb-28 md:min-h-[700px] md:pt-28">
        {/* Animated blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/30 rounded-full blur-[100px] animate-float-blob" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-accent/30 rounded-full blur-[100px] animate-float-blob" style={{ animationDelay: "-5s" }} />
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-[100px] animate-float-blob" style={{ animationDelay: "-9s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-yellow-500/20 rounded-full blur-[80px] animate-float-blob" style={{ animationDelay: "-3s" }} />
        </div>

        {/* Subtle grid + vignette for depth on all screens */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-background" />

        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="relative z-10 mx-auto max-w-5xl text-center"
        >
          {/* Logo icon */}
          <div className="relative mb-6 flex justify-center sm:mb-8">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150 animate-pulse" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="relative z-10 flex items-center justify-center glow-primary shadow-2xl"
            >
              <Logo size={96} glow={false} />
            </motion.div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mb-6 font-heading text-4xl font-black tracking-tight text-gradient-animate drop-shadow-xl sm:text-5xl md:text-6xl"
          >
            NaliBase
          </motion.h1>

          {/* NaliBase hub: the logged-in home is a launch world, not a dashboard. */}
          {user && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-8 w-full max-w-5xl text-left">
              <p className="text-center text-xs font-bold uppercase tracking-[0.28em] text-primary">
                Welcome to NaliBase, {(user.display_name || user.full_name)?.split(" ")[0] || "Creator"}
              </p>
              <h2 className="mt-2 text-center font-heading text-3xl font-black sm:text-5xl">Where do you want to go?</h2>
              <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">Your entertainment and creativity universe. Choose a world and step inside.</p>
              <div className="mx-auto mt-6 max-w-3xl" aria-label="NaliBase Central Plaza map">
                <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-foreground/45">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">You are here · Central Plaza</span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
                </div>
                <div className="relative mx-auto mt-2 h-5 max-w-2xl" aria-hidden="true">
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                  <motion.span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,.55)]" animate={{ y: [0, 12, 0], opacity: [.45, 1, .45] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} />
                </div>
              </div>
              <div className="mx-auto mb-5 max-w-3xl">
                <a href={NALIBASE_OS_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("post_login_action", { user_id: user.id, source: "nalibase_hub", action: "open_nalibase_os" })} className="group flex items-center gap-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-violet-500/15 px-5 py-4 shadow-lg backdrop-blur-xl transition hover:border-cyan-300/40 hover:bg-white/[.08]">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200"><Monitor className="h-6 w-6" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">NaliBase System</span><span className="mt-1 block font-heading text-lg font-black">Launch NaliBase OS</span><span className="block text-xs text-foreground/55">Open the Aurora Pro desktop environment.</span></span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-cyan-200/60 transition group-hover:translate-x-1 group-hover:text-cyan-100" />
                </a>
              </div>
              {lastVisitedWorld && (
                <div className="mb-4 flex justify-center">
                  <Link to={lastVisitedWorld.path} onClick={() => trackProductEvent("post_login_action", { user_id: user.id, source: "nalibase_hub", action: `return_${lastVisitedWorld.id}` })} className={`group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${lastVisitedWorld.plazaGradient} px-4 py-3 text-left shadow-lg backdrop-blur-xl transition hover:border-white/25 hover:shadow-xl`}>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/45">Continue your journey</span>
                    <span className="font-heading text-sm font-black">Return to {lastVisitedWorld.label}</span>
                    <span className="hidden text-xs text-foreground/50 sm:inline">{lastVisitedWorld.name}</span>
                    <ArrowRight className="h-4 w-4 text-foreground/45 transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                  </Link>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PLAZA_WORLDS.map((world) => {
                  const WorldIcon = world.icon;
                  return (
                    <motion.div key={world.title} whileHover={{ y: -5, scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.2 }}>
                      <Link to={world.path} onClick={() => trackProductEvent("post_login_action", { user_id: user.id, source: "nalibase_hub", action: world.action })} className={`group relative flex min-h-44 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${world.gradient} p-5 shadow-xl backdrop-blur-xl transition-all hover:border-white/25 hover:shadow-2xl`}>
                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-3xl transition-transform group-hover:scale-150" />
                        <div className="relative z-10 flex w-full flex-col">
                          <div className="flex items-start justify-between">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20"><WorldIcon className="h-5 w-5" /></div>
                            <ArrowRight className="h-5 w-5 text-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                          </div>
                          <div className="mt-auto pt-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/60">{world.subtitle}</p>
                            <h3 className="mt-1 font-heading text-2xl font-black tracking-tight">{world.title}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-foreground/70">{world.description}</p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
                  <MapPin className="h-3 w-3" />
                  Central Plaza · Six worlds
                </div>
                <p className="text-xs text-muted-foreground">One identity. Multiple worlds. Return to NaliBase anytime to choose your next experience.</p>
              </div>
            </motion.div>
          )}

          {!user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/20 to-pink-500/20 px-4 py-2 text-xs font-bold text-foreground backdrop-blur-md sm:px-5"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              THE CREATOR WORKSPACE · PREMIUM POWER WHEN YOU'RE READY
            </motion.div>
          )}

          {!user && (
            <>
              <h1 className="mb-5 font-heading text-4xl font-black leading-[1.02] tracking-tight drop-shadow-xl text-gradient-animate sm:text-6xl md:mb-6 md:text-8xl lg:text-[7rem]">
                Make Music.<br className="hidden md:block" />{" "}
                <span>Connect. Create. Grow.</span>
              </h1>
              <p className="mx-auto mb-5 max-w-3xl text-base font-medium leading-relaxed text-foreground/90 sm:text-xl md:text-2xl">
                Message creators, record and produce in NaliStudio, share files, and build projects together — all in one place.
              </p>
              <p className="mx-auto mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:mb-6">
                Join with Google in one tap. No card. No payment. Start creating immediately.
              </p>
              <div className="mx-auto mb-5 hidden max-w-3xl rounded-3xl border border-primary/25 bg-card/55 p-4 text-left shadow-2xl backdrop-blur-xl sm:block sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-primary/15 p-2"><Music className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-sm font-black text-foreground sm:text-base">Your music workspace is ready when you are.</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">Record and produce in NaliStudio, message creators, and keep project files together. Premium expands the workflow with more AI and advanced creator tools.</p>
                  </div>
                </div>
              </div>
              <div className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-foreground/80 sm:text-sm">
                <span className="inline-flex items-center gap-1.5"><Music className="h-4 w-4 text-primary" /> NaliStudio</span>
                <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-primary" /> Creator messaging</span>
                <span className="inline-flex items-center gap-1.5"><FolderKanban className="h-4 w-4 text-primary" /> Project sharing</span>
              </div>
            </>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-sm mx-auto sm:max-w-none">
            {user ? null : (
              <>
                <Button size="lg" className="ui-hover min-h-12 w-full rounded-xl bg-gradient-to-r from-primary to-pink-500 px-7 text-base font-semibold glow-primary shimmer-hover hover:opacity-90 sm:w-auto" asChild>
                  <Link
                    to="/register"
                    className="w-full sm:w-auto"
                    onClick={() => trackProductEvent("signup_click", { source: "home_hero", cta: "start_creating_free" })}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Start Creating Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="ui-hover min-h-12 w-full rounded-xl border-white/20 bg-card/30 px-7 text-base font-semibold backdrop-blur-xl sm:w-auto" asChild>
                  <a
                    href="#studio-demo"
                    className="w-full sm:w-auto"
                    onClick={() => trackProductEvent("homepage_demo_click", { source: "home_hero", target: "studio_tutorial" })}
                  >
                    <Video className="w-5 h-5 mr-2" />
                    See NaliStudio in Action
                  </a>
                </Button>
              </>
            )}
          </div>

          {/* Trust strip */}
          {!user && (
            <p className="mx-auto mt-5 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
             Start creating immediately · Premium unlocks more AI, advanced Studio tools and larger creative workflows
            </p>
          )}
        </motion.div>
      </section>

      {!user && authChecked && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/90 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,.28)] backdrop-blur-xl sm:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-black text-foreground">Start creating free</p>
              <p className="truncate text-[11px] text-muted-foreground">No card · Google or email</p>
            </div>
            <Button size="sm" className="min-h-11 shrink-0 rounded-xl bg-gradient-to-r from-primary to-pink-500 px-5 font-bold glow-primary" asChild>
              <Link
                to="/register"
                onClick={() => trackProductEvent("signup_click", { source: "home_mobile_sticky", cta: "start_creating_free" })}
              >
                Start Free
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {!user && <>
      {/* — Fast reassurance for visitors deciding whether to continue — */}
      <section className="relative z-10 border-y border-border/70 bg-card/55 px-4 py-5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-bold text-foreground sm:text-base">See what NaliChat can do before you sign up.</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Watch the NaliStudio walkthrough, then create your free account when you're ready.</p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="min-h-11 rounded-xl border-white/20 bg-background/30" asChild>
              <a href="#studio-demo" onClick={() => trackProductEvent("homepage_demo_click", { source: "home_reassurance", target: "studio_tutorial" })}>
                <Video className="mr-2 h-4 w-4" /> Watch Studio Demo
              </a>
            </Button>
            <Button className="min-h-11 rounded-xl bg-gradient-to-r from-primary to-pink-500" asChild>
              <Link to="/register" onClick={() => trackProductEvent("signup_click", { source: "home_reassurance", cta: "start_free" })}>
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* — Pillar pills — */}
      <section className="relative z-10 overflow-hidden border-b border-border/70 bg-card/50 py-3 backdrop-blur-xl sm:py-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="no-scrollbar flex justify-start gap-2 overflow-x-auto px-4 sm:flex-wrap sm:justify-center sm:gap-3 sm:px-6"
        >
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="flex shrink-0 items-center gap-2 rounded-full bg-secondary/60 px-4 py-2 text-sm font-medium">
                <Icon className={`w-4 h-4 ${p.color}`} />
                <span className="text-foreground/80">{p.label}</span>
              </div>
            );
          })}
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl space-y-14 px-4 py-12 sm:space-y-20 sm:px-6 sm:py-16 lg:space-y-24 lg:py-20">

        {/* — What You Can Do — */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="ui-surface relative w-full overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:p-8 md:p-12"
        >
          <div className="absolute -inset-px bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-primary">The NaliBase Universe</p>
            <h2 className="font-heading font-bold text-3xl md:text-5xl mb-3">Six worlds. One identity. Endless creative movement.</h2>
            <p className="text-foreground/90 text-lg mb-10 max-w-3xl">NaliBase is designed as a universe, not a pile of pages. Every world has a purpose, its own districts and a direct path back to the Hub, so your creative life stays connected as the platform grows.</p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {[
                {
                  title: "🎧 Produce in the Studio",
                  items: ["Full DAW Interface", "Live Video Jam Rooms", "AI Stem Separation", "AI Stem Generation", "AI Mastering", "AI BPM/Genre/Key Tagging"],
                  link: "/studio",
                  linkLabel: "Open Studio"
                },
                {
                  title: "📁 Projects & Organization",
                  items: ["Create & manage projects", "Organize tracks & stems", "Set milestones & statuses", "Folders for files"],
                  link: "/projects-summary",
                  linkLabel: "Manage Projects"
                },
                {
                  title: "💬 Creator Messaging & Collaboration",
                  items: ["Real-time direct & group messaging", "Voice notes & audio sharing", "Real-time co-editing", "Find collaborators", "Secure file sharing"],
                  link: "/messages",
                  linkLabel: "Open Messages"
                },
                {
                  title: "🎨 Create & Share",
                  items: ["Art posts with album art", "AI Cover Art Generation", "Cloud File Storage", "Custom Playlists"],
                  link: "/explore",
                  linkLabel: "Explore"
                },
                {
                  title: "📈 Build Your Presence",
                  items: ["Release your tracks", "Discover creator music", "Climb the leaderboard", "Grow your following"],
                  link: "/leaderboard",
                  linkLabel: "View Leaderboard"
                },
                {
                  title: "👤 Showcase Talent",
                  items: ["Creator Profiles", "Earn Achievements", "Display Portfolio", "Level Up Status"],
                  link: "/profile",
                  linkLabel: "View Profile"
                }
              ].map((block) => (
                <div key={block.title} className="ui-surface ui-hover group flex h-full min-w-0 flex-col break-words rounded-3xl border border-white/[0.06] bg-card/40 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-card/60 focus-within:ring-2 focus-within:ring-primary/30 sm:p-6">
                  <h3 className="font-heading font-bold text-xl mb-4">{block.title}</h3>
                  <ul className="space-y-2 flex-1 mb-6">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-foreground/90">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {block.link && (
                    <Link to={block.link} className="ui-hover mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40">
                      {block.linkLabel} <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* — Quick Start Guide — */}
        <QuickStartGuide />

        {/* — Studio Video Tutorial — */}
        <div id="studio-demo" className="scroll-mt-24">
          <StudioTutorial />
        </div>

        {/* — Messaging Hero Card — */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to={user ? "/messages" : "/register"}>
            <div className="ui-surface ui-hover group relative cursor-pointer overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-8 md:p-12">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold tracking-widest text-primary uppercase bg-primary/10 px-3 py-1 rounded-full">Live Collaboration</span>
                  </div>
                  <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl mb-3 flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-primary shrink-0" />
                    Seamless Communication
                  </h2>
                  <p className="text-lg text-foreground/90 mb-6 max-w-xl">
                    Connect instantly with other artists. Share files, exchange ideas, and collaborate without friction. All conversations in one organized inbox.
                  </p>
                  <div className="flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
                    Start connecting <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 md:w-48 md:grid-cols-1 md:gap-3 shrink-0">
                  <div className="bg-primary/10 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-primary">DMs</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Direct & group</p>
                  </div>
                  <div className="bg-accent/10 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-accent">Live</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Real-time</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-purple-400">24/7</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Always On</p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* — Nali AI Banner — */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="ui-surface relative overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] sm:p-8 md:p-10">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-yellow-500/10 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 shrink-0 rounded-3xl bg-gradient-to-br from-yellow-500 via-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold tracking-widest text-yellow-400 uppercase bg-yellow-400/10 px-3 py-1 rounded-full">Meet Nali AI</span>
                </div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl mb-2">Your Personal Music Assistant</h2>
                <p className="text-foreground/90 leading-relaxed">
                  Premium adds NALI.ai for production guidance, track-tag suggestions, Studio help, and creator questions across the app—giving serious creators a faster, deeper workflow.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* — Features Grid — */}
        <div>
          <div className="mb-10 md:mb-12 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl mb-4 text-gradient-animate drop-shadow-lg inline-block">Everything You Need</h2>
              <p className="text-foreground/70 text-xl font-medium">One explosive platform. Every tool a music creator could want.</p>
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
            {features.map((feature) => {
               const Icon = feature.icon;
               return (
                 <motion.div key={feature.label} variants={itemVariants} className="h-full">
                   <Link to={feature.path} onClick={() => sounds.click()} className="block h-full">
                     <div className="ui-surface ui-hover group relative h-full overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-card/70 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] focus-visible:ring-2 focus-visible:ring-primary/40">
                       <div className={`absolute -inset-20 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.08] blur-3xl transition-opacity duration-500 pointer-events-none`} />
                       <div className="relative h-full p-6 flex flex-col justify-between">
                         <div className="flex-1">
                           {feature.badge && (
                             <span className={`absolute top-5 right-5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-gradient-to-r ${feature.gradient} text-white shadow-lg`}>
                               {feature.badge}
                             </span>
                           )}
                           <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                             <Icon className="w-6 h-6 text-white" />
                           </div>
                           <h3 className="font-heading font-bold text-lg mb-1.5 text-foreground">{feature.label}</h3>
                           <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                         </div>
                         <div className="flex items-center gap-1.5 mt-4 shrink-0 text-xs font-semibold text-primary transition-all duration-300 group-hover:gap-2.5">
                           Explore <ArrowRight className="w-3.5 h-3.5" />
                         </div>
                       </div>
                     </div>
                   </Link>
                 </motion.div>
               );
             })}
          </motion.div>
        </div>

        {/* — Interactive Tutorial — */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="ui-surface flex flex-col items-start justify-between gap-6 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] sm:p-8 md:flex-row md:items-center">
            <div>
              <h3 className="font-heading font-bold text-2xl mb-2 text-foreground">Interactive Tutorial</h3>
              <p className="text-muted-foreground text-lg">New to NaliBase? Take our interactive onboarding wizard to get up to speed in seconds.</p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
              <Button onClick={() => setShowWizard(true)} size="lg" className="ui-hover h-12 w-full rounded-xl bg-indigo-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-400/50 sm:h-14 sm:w-auto sm:px-8 sm:text-base">
                Start Onboarding Wizard
              </Button>
              {user && (
                <Button onClick={() => setShowTour(true)} variant="outline" size="lg" className="ui-hover h-12 w-full rounded-xl px-5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-14 sm:w-auto sm:px-8 sm:text-base">
                  Take Welcome Tour
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <InteractiveWizard open={showWizard} onOpenChange={setShowWizard} />

        <WelcomeTour open={showTour} onClose={() => setShowTour(false)} />

        {/* — How it Works — */}
        <HowItWorks />

        {/* — Creator value — */}
        <div>
          <div className="text-center mb-10">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3">Built for the Creative Workflow</h2>
            <p className="text-foreground/90 text-lg">Core ways NaliBase helps creators move from idea to release</p>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {creatorBenefits.map((t) => (
              <motion.div key={t.name} variants={itemVariants}>
                <div className="bg-card/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 h-full hover:border-white/[0.12] hover:bg-card/70 transition-all duration-300">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed mb-5 italic">"{t.quote}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm`}>
                        {t.avatar}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                    {t.metric && (
                      <div className="text-right">
                        <p className="font-bold text-primary text-sm">{t.metric}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* — Stats — */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
          {[
            { value: "Studio", label: "Create & master", from: "from-primary", to: "to-pink-500" },
            { value: "Chat", label: "Message & collaborate", from: "from-accent", to: "to-cyan-400" },
            { value: "Files", label: "Share & organize", from: "from-pink-500", to: "to-purple-500" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-card/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 md:p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-card/70 group overflow-hidden relative`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.from} ${stat.to} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`} />
              <div className="relative z-10">
                <p className={`text-5xl sm:text-6xl md:text-7xl font-black mb-3 bg-gradient-to-br ${stat.from} ${stat.to} bg-clip-text text-transparent tracking-tighter drop-shadow-sm group-hover:scale-110 transition-transform duration-500`}>{stat.value}</p>
                <p className="text-foreground/80 font-bold tracking-wide uppercase text-xs md:text-sm">{stat.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* — Final CTA — */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="mb-24"
        >
          <div className="ui-surface relative overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-5 text-center backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] sm:p-12 md:p-16">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/40 rounded-full blur-[100px] animate-pulse" />
              <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/40 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
            </div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-6 md:mb-8 rounded-[2rem] bg-gradient-to-br from-primary via-pink-500 to-accent flex items-center justify-center glow-primary shadow-2xl animate-float-blob border border-white/20">
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
              </div>
              <h3 className="font-heading font-black text-4xl sm:text-5xl md:text-7xl mb-4 md:mb-6 text-gradient-animate drop-shadow-xl tracking-tight">
                {user ? `Start Chatting, ${(user.display_name || user.full_name)?.split(" ")[0] || "Creator"}` : "Collaboration Starts Here"}
              </h3>
              <p className="text-lg sm:text-xl text-foreground/90 font-medium mb-8 md:mb-10 max-w-3xl mx-auto leading-relaxed">
                {user
                  ? "Jump into your messages, share your latest ideas, and connect with your team instantly."
                  : "Start creating, move between NaliBase worlds, and unlock Premium power as your workflow grows."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center w-full max-w-sm mx-auto sm:max-w-none">
                {user ? (
                    <>
                      <Button size="lg" className="w-full sm:w-auto rounded-2xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary transition-all hover:scale-105" asChild>
                        <Link to="/messages" className="w-full sm:w-auto">
                          <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                          Open Messages
                        </Link>
                        </Button>

                    </>
                  ) : (
                  <>
                    <Button size="lg" className="w-full sm:w-auto rounded-xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary transition-all hover:scale-105 shadow-xl shadow-primary/30" asChild>
                      <Link
                        to="/register"
                        className="w-full sm:w-auto"
                        onClick={() => trackProductEvent("signup_click", { source: "home_bottom_cta", cta: "start_creating_free" })}
                      >
                        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                        Start Free
                        <ArrowRight className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3" />
                      </Link>
                      </Button>
                  </>
                )}
              </div>
              {!user && (
                <p className="mt-8 text-sm font-bold text-muted-foreground tracking-wide uppercase">
                  Create immediately · Upgrade to Premium for the complete creator toolkit
                </p>
              )}
            </div>
          </div>
        </motion.div>

        </section>
      </>}

      {!user && (
          <footer className="pb-4 text-center text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <Link to="/privacy" className="min-h-10 inline-flex items-center hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="min-h-10 inline-flex items-center hover:text-foreground">Terms of Service</Link>
              <Link to="/login" className="min-h-10 inline-flex items-center hover:text-foreground">Sign In</Link>
              <Link to="/register" className="min-h-10 inline-flex items-center hover:text-foreground">Create Account</Link>
              <Link to="/pricing" className="min-h-10 inline-flex items-center hover:text-foreground">Compare Plans</Link>
              <a href="mailto:support@nalichat.org" className="min-h-10 inline-flex items-center hover:text-foreground">Contact Support</a>
            </div>
            <p className="mt-2">NaliBase · Six connected worlds for creativity, entertainment, collaboration, and discovery</p>
          </footer>
        )}

    </PullToRefresh>
  );
}