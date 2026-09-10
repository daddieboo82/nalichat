import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Music, BarChart3, Sparkles,
  Trophy, ArrowRight, Zap, Shield, Star,
  Headphones, Wand2, FileAudio, ChevronRight, UserCircle, Video, Layers, ShoppingCart,
  SlidersHorizontal, Tag, FolderKanban
} from "lucide-react";
import { motion } from "framer-motion";
import QuickStartGuide from "@/components/home/QuickStartGuide";
import StudioTutorial from "@/components/home/StudioTutorial";
import HowItWorks from "@/components/home/HowItWorks";
import InteractiveWizard from "@/components/onboarding/InteractiveWizard";
import WelcomeTour from "@/components/onboarding/WelcomeTour";
import ImmersiveOnboarding from "@/components/onboarding/ImmersiveOnboarding";
import DonationButton from "@/components/home/DonationButton";
import QuickAccessGrid from "@/components/home/QuickAccessGrid";
import { sounds } from "@/hooks/use-sound";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/layout/PullToRefresh";
import Logo from "@/components/branding/Logo";

const features = [
  {
    icon: MessageSquare,
    label: "Unlimited Messages",
    path: "/messages",
    description: "Real-time messaging, unlimited voice notes & high-res file sharing",
    gradient: "from-primary to-pink-500",
    badge: "Free",
  },
  {
    icon: Video,
    label: "Live Jam Rooms",
    path: "/studio",
    description: "Real-time multiplayer Studio co-editing with live audio and video.",
    gradient: "from-accent to-cyan-500",
    badge: "Pro",
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
    badge: "Pro",
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
    label: "Stems Marketplace",
    path: "/explore",
    description: "Drop your music, discover trending tracks, and buy or sell stem licenses.",
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
    badge: "Pro",
  },
];

const testimonials = [
  {
    name: "Jordan K.",
    role: "Producer",
    avatar: "J",
    color: "from-primary to-pink-500",
    quote: "Went from garage bedroom to 10K followers in 3 months. Found my collaborators here and released 8 tracks together.",
    metric: "8 tracks released",
  },
  {
    name: "Dre M.",
    role: "Beatmaker",
    avatar: "D",
    color: "from-yellow-500 to-orange-500",
    quote: "Assembled my entire production team here. We ship 4 tracks a week now instead of 1. All remote. Makes real money.",
    metric: "Team of 4",
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
  const { user: authUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // Only treat as logged-in when both the flag and the user record are present,
  // so the greeting disappears instantly on logout.
  const user = isAuthenticated ? authUser : null;

  // Auto-show the welcome tour for users who finished onboarding but haven't seen it yet.
  useEffect(() => {
    if (user && user.onboarding_completed && !user.welcome_tour_completed) {
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries()} className="h-full overflow-auto bg-background">

      {/* ── Immersive onboarding for first-time visitors ── */}
      {!user && <ImmersiveOnboarding />}

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-32 min-h-[100dvh] md:min-h-[700px]">
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
          className="relative z-10 text-center max-w-5xl mx-auto"
        >
          {/* Logo icon */}
          <div className="mb-8 flex justify-center relative">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150 animate-pulse" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="relative z-10 flex items-center justify-center glow-primary shadow-2xl"
            >
              <Logo size={96} glow={false} />
            </motion.div>
          </div>

          {/* Personalized greeting */}
          {user && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold tracking-[0.2em] text-primary mb-4 uppercase drop-shadow-md"
            >
              Welcome back, {(user.display_name || user.full_name)?.split(" ")[0] || "Creator"} 🚀
            </motion.p>
          )}

          {!user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 to-pink-500/20 border border-primary/40 text-foreground text-xs font-bold px-5 py-2 rounded-full mb-6 backdrop-blur-md"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              The Ultimate Messaging App for Creators
            </motion.div>
          )}

          <h1 className="font-heading font-black text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] mb-6 tracking-tight leading-[1.05] drop-shadow-xl text-gradient-animate">
            Real-Time<br className="hidden md:block" />{" "}
            <span>Messaging</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-foreground/90 font-medium mb-10 md:mb-12 leading-relaxed max-w-3xl mx-auto">
            Connect instantly with artists globally. Share high-res audio, drop voice notes, and collaborate seamlessly in unlimited chats.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-sm mx-auto sm:max-w-none">
            {user ? (
              <>
                <Link to="/messages" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover px-7">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Open Messages
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

                <Link to="/studio" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-accent to-cyan-500 hover:opacity-90 text-base glow-accent shimmer-hover px-7">
                    <Music className="w-5 h-5 mr-2" />
                    Open Studio
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

              </>
            ) : (
              <>
                <Link to="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover px-7">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Donation button */}
          <div className="mt-8 flex justify-center">
            <DonationButton />
          </div>

          {/* Trust strip */}
          {!user && (
            <p className="mt-5 text-sm text-muted-foreground">
             ✅ Unlimited Messages · 🚀 High-Res Sharing · 💯 Always Free
            </p>
          )}
        </motion.div>
      </section>

      {/* ── Quick Access for logged-in users ── */}
      {user && <QuickAccessGrid />}

      {/* ── Pillar pills ── */}
      <section className="relative z-10 overflow-hidden border-y border-border bg-card/40 py-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap justify-center gap-3 px-6"
        >
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="flex items-center gap-2 bg-secondary/60 rounded-full px-4 py-2 text-sm font-medium">
                <Icon className={`w-4 h-4 ${p.color}`} />
                <span className="text-foreground/80">{p.label}</span>
              </div>
            );
          })}
        </motion.div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 space-y-24">

        {/* ── What You Can Do ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-full bg-card/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 md:p-12 overflow-hidden"
        >
          <div className="absolute -inset-px bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-2xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3">What You Can Actually Do</h2>
            <p className="text-foreground/90 text-lg mb-10 max-w-2xl">Everything you need to discover music, collaborate with artists, produce your sound, and grow your audience:</p>
            
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
                  title: "💬 Connect & Collaborate",
                  items: ["Direct & group messaging", "Real-time Co-editing", "Find collaborators", "Secure file sharing", "Contacts & notifications"],
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
                  items: ["Release your tracks", "Stems Marketplace licensing", "Climb the leaderboard", "Grow your following"],
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
                <div key={block.title} className="h-full flex flex-col border border-white/[0.06] rounded-2xl p-6 bg-card/40 backdrop-blur-xl transition-all duration-300 min-w-0 break-words group hover:border-white/[0.12] hover:bg-card/60 hover:-translate-y-0.5">
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
                    <Link to={block.link} className="inline-flex items-center gap-2 text-primary font-medium group-hover:underline mt-auto">
                      {block.linkLabel} <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Quick Start Guide ── */}
        <QuickStartGuide />

        {/* ── Studio Video Tutorial ── */}
        <StudioTutorial />

        {/* ── Messaging Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to={user ? "/messages" : "/register"}>
            <div className="group relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 md:p-12 hover:border-white/[0.12] hover:bg-card/70 transition-all duration-300 cursor-pointer hover:-translate-y-1">
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

                <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:w-48 shrink-0">
                  <div className="bg-primary/10 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-primary">1K+</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Active Collabs</p>
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

        {/* ── Nali AI Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-xl border border-white/[0.06] p-8 md:p-10 hover:border-white/[0.12] transition-all duration-300">
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
                  Need help? You can ask Nali to perform tasks across the app, suggest track tags, or answer absolutely anything music-related. From production tips to navigating the studio, Nali is here to help you create your best work.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Features Grid ── */}
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
                     <div className="group relative rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl h-full transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-card/70 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] overflow-hidden">
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

        {/* ── Interactive Tutorial ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="bg-card/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-white/[0.12] transition-all duration-300">
            <div>
              <h3 className="font-heading font-bold text-2xl mb-2 text-foreground">Interactive Tutorial</h3>
              <p className="text-muted-foreground text-lg">New to NaliChat? Take our interactive onboarding wizard to get up to speed in seconds.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button onClick={() => setShowWizard(true)} size="lg" className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-14 px-8 text-lg font-bold shadow-lg shadow-indigo-500/20">
                Start Onboarding Wizard
              </Button>
              {user && (
                <Button onClick={() => setShowTour(true)} variant="outline" size="lg" className="rounded-xl h-14 px-8 text-lg font-bold">
                  Take Welcome Tour
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <InteractiveWizard open={showWizard} onOpenChange={setShowWizard} />

        <WelcomeTour open={showTour} onClose={() => setShowTour(false)} />

        {/* ── How it Works ── */}
        <HowItWorks />

        {/* ── Testimonials ── */}
        <div>
          <div className="text-center mb-10">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3">Loved by Creators</h2>
            <p className="text-foreground/90 text-lg">What artists are saying about NaliChat</p>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {testimonials.map((t) => (
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

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
          {[
            { value: "10K+", label: "Tracks Shared", from: "from-primary", to: "to-pink-500" },
            { value: "50K+", label: "Active Creators", from: "from-accent", to: "to-cyan-400" },
            { value: "100K+", label: "Conversations", from: "from-pink-500", to: "to-purple-500" },
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

        {/* ── Final CTA ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="mb-24"
        >
          <div className="relative overflow-hidden bg-card/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 sm:p-12 md:p-16 text-center hover:border-white/[0.12] transition-all duration-300">
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
                  : "Join thousands of artists already chatting, sharing, and collaborating on NaliChat."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center w-full max-w-sm mx-auto sm:max-w-none">
                {user ? (
                    <>
                      <Link to="/messages" className="w-full sm:w-auto">
                        <Button size="lg" className="w-full sm:w-auto rounded-2xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary transition-all hover:scale-105">
                          <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                          Open Messages
                        </Button>
                      </Link>

                    </>
                  ) : (
                  <>
                    <Link to="/register" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full sm:w-auto rounded-xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary transition-all hover:scale-105 shadow-xl shadow-primary/30">
                        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                        Get Started Free
                        <ArrowRight className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              {!user && (
                <p className="mt-8 text-sm font-bold text-muted-foreground tracking-wide uppercase">
                  ✨ Completely free messaging · No credit card required · No trials ✨
                </p>
              )}
            </div>
          </div>
        </motion.div>

      </section>
    </PullToRefresh>
  );
}