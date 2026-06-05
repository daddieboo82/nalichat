import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Music, Users, BarChart3, Sparkles,
  Trophy, Compass, Play, ArrowRight, Zap, Shield, Star,
  Headphones, Radio, Wand2, FileAudio, ChevronRight,
  Image, Cloud, UserCircle, Video, Layers, ShoppingCart
} from "lucide-react";
import { motion } from "framer-motion";
import DailyRecommendation from "@/components/home/DailyRecommendation";
import QuickStartGuide from "@/components/home/QuickStartGuide";
import { sounds } from "@/hooks/use-sound";

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

const steps = [
  {
    number: "01",
    icon: Layers,
    title: "Produce with AI & Stems",
    description: "Record, mix, and master using our built-in DAW. Use AI to separate stems or generate new samples instantly.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    number: "02",
    icon: Video,
    title: "Collaborate Live in Jam Rooms",
    description: "Launch a live Audio/Video Jam Room right in the Studio to co-edit tracks with your collaborators in real-time.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    number: "03",
    icon: ShoppingCart,
    title: "Release & Sell Licenses",
    description: "Drop your music to Explore, climb the Leaderboard, and securely sell stem licenses directly to your fans.",
    color: "text-accent",
    bg: "bg-accent/10",
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
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(err => {
        // Expected when not logged in
        if (err.status !== 401 && err.status !== 403) {
          console.warn("Auth check error:", err.message);
        }
      });
  }, []);

  return (
    <div className="h-full overflow-auto bg-background">

      {/* ── Daily Recommendation ── */}
      <DailyRecommendation />

      {/* ── Hero ── */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden px-6 py-24">
        {/* Animated blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/30 rounded-full blur-[100px] animate-float-blob" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-accent/30 rounded-full blur-[100px] animate-float-blob" style={{ animationDelay: "-5s" }} />
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-[100px] animate-float-blob" style={{ animationDelay: "-9s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-yellow-500/20 rounded-full blur-[80px] animate-float-blob" style={{ animationDelay: "-3s" }} />
        </div>

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
              className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-pink-500 to-accent flex items-center justify-center glow-primary shadow-2xl border border-white/20"
            >
              <MessageSquare className="w-12 h-12 text-white" />
            </motion.div>
          </div>

          {/* Personalized greeting */}
          {user && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold tracking-[0.2em] text-primary mb-4 uppercase drop-shadow-md"
            >
              Welcome back, {user.full_name?.split(" ")[0] || "Creator"} 🚀
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

          <h1 className="font-heading font-black text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] mb-6 tracking-tight leading-[1.05] drop-shadow-xl text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60">
            Real-Time.<br className="hidden md:block" /> 
            <span className="text-gradient-animate drop-shadow-2xl">Messaging.</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-foreground/80 font-medium mb-10 md:mb-12 leading-relaxed max-w-3xl mx-auto drop-shadow-md">
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
                <Link to="/explore" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl text-base px-7">
                    <Compass className="w-5 h-5 mr-2" />
                    Browse Tracks
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover px-7">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Start Chatting Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/explore" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl text-base px-7">
                    <Play className="w-5 h-5 mr-2" />
                    Browse Tracks
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Trust strip */}
          {!user && (
            <p className="mt-5 text-sm text-muted-foreground">
             ✅ Unlimited Messages · 🚀 High-Res Sharing · 💳 No credit card to start
            </p>
          )}
        </motion.div>
      </section>

      {/* ── Pillar pills ── */}
      <section className="relative z-10 overflow-hidden border-y border-border bg-card/40 py-4">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
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
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-card border border-border rounded-3xl p-8 md:p-12 overflow-hidden"
        >
          <div className="absolute -inset-px bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-3xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3">What You Can Actually Do</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl">Everything you need to discover music, collaborate with artists, produce your sound, and grow your audience:</p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "🎧 Produce in the Studio",
                  items: ["Full DAW Interface", "Live Video Jam Rooms", "AI Stem Separation", "AI Stem Generation"]
                },
                {
                  title: "💬 Connect & Collaborate",
                  items: ["Unlimited messaging", "Real-time Co-editing", "Find collaborators", "Network with peers"]
                },
                {
                  title: "🎨 Create & Manage",
                  items: ["AI Cover Art Generation", "Cloud File Storage", "Custom Playlists", "Stem Organization"]
                },
                {
                  title: "📈 Build Your Presence",
                  items: ["Release your tracks", "Buy & Sell Stem Licenses", "Climb the leaderboard", "Grow your following"]
                },
                {
                  title: "👤 Showcase Talent",
                  items: ["Creator Profiles", "Earn Achievements", "Display Portfolio", "Level Up Status"]
                }
              ].map((block) => (
                <div key={block.title} className="border border-border/50 rounded-2xl p-6 bg-card/50 hover:border-primary/30 transition-colors">
                  <h3 className="font-heading font-bold text-xl mb-4">{block.title}</h3>
                  <ul className="space-y-2">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Quick Start Guide ── */}
        <QuickStartGuide />

        {/* ── Messaging Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <Link to={user ? "/messages" : "/register"}>
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 p-6 sm:p-8 md:p-12 hover:border-primary/40 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold tracking-widest text-primary uppercase bg-primary/10 px-3 py-1 rounded-full">Live Collaboration</span>
                  </div>
                  <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl mb-3 flex items-center gap-3">
                   <MessageSquare className="w-8 h-8 text-primary shrink-0" />
                   Real-Time Messaging
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6 max-w-xl">
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
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-yellow-500/10 via-card to-primary/15 border border-yellow-500/20 p-8 md:p-10">
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
                <p className="text-muted-foreground leading-relaxed">
                 Need help? You can ask Nali to perform tasks across the app, suggest track tags, or answer absolutely anything music-related. From production tips to navigating the studio, Nali is here to help you create your best work.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Features Grid ── */}
        <div>
          <div className="mb-10 md:mb-12 text-center md:text-left">
            <h2 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl mb-4 text-gradient-animate drop-shadow-lg inline-block">Everything You Need</h2>
            <p className="text-foreground/70 text-xl font-medium">One explosive platform. Every tool a music creator could want.</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.path} variants={itemVariants} className="h-full">
                  <Link to={feature.path} onClick={() => sounds.click()} className="block h-full">
                    <div className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${feature.gradient} p-0.5 h-full transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]`}>
                      <div className="relative h-full bg-card/90 backdrop-blur-xl rounded-[22px] p-8 shimmer-hover flex flex-col justify-between overflow-hidden">
                        <div className={`absolute -inset-10 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500`} />
                        
                        <div className="relative z-10 flex-1">
                          {feature.badge && (
                            <span className={`absolute top-0 right-0 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-gradient-to-r ${feature.gradient} text-white shadow-lg`}>
                              {feature.badge}
                            </span>
                          )}
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                            <Icon className="w-7 h-7 text-white" />
                          </div>
                          <h3 className="font-heading font-black text-2xl mb-2 text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-br group-hover:from-white group-hover:to-white/70 transition-colors duration-300">{feature.label}</h3>
                          <p className="text-base text-foreground/70 font-medium leading-relaxed">{feature.description}</p>
                        </div>
                        
                        <div className="relative z-10 flex items-center gap-2 mt-6 text-sm font-bold opacity-0 -translate-x-4 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 text-foreground">
                          Explore feature <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── How it Works ── */}
        <div>
          <div className="text-center mb-10 md:mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">From zero to released — NaliChat covers every step of your creative process.</p>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.number} variants={itemVariants} className="relative">
                  <div className="bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/40 transition-colors duration-300">
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${step.color}`} />
                      </div>
                      <span className="text-4xl font-black text-border">{step.number}</span>
                    </div>
                    <h3 className="font-heading font-bold text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── Testimonials ── */}
        <div>
          <div className="text-center mb-10">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3">Loved by Creators</h2>
            <p className="text-muted-foreground text-lg">What artists are saying about NaliChat</p>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={itemVariants}>
                <div className="bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/30 transition-colors duration-300">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic">"{t.quote}"</p>
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
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {[
           { value: "10K+", label: "Tracks Shared", from: "from-primary", to: "to-pink-500", hover: "hover:border-primary/50 hover:shadow-[0_0_40px_-10px_rgba(var(--primary-rgb),0.5)]" },
           { value: "50K+", label: "Active Creators", from: "from-accent", to: "to-cyan-400", hover: "hover:border-accent/50 hover:shadow-[0_0_40px_-10px_rgba(var(--accent-rgb),0.5)]" },
           { value: "100K+", label: "Conversations", from: "from-pink-500", to: "to-purple-500", hover: "hover:border-pink-500/50 hover:shadow-[0_0_40px_-10px_rgba(236,72,153,0.5)]" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-card/80 backdrop-blur-xl border-2 border-border/50 rounded-3xl md:rounded-[2rem] p-8 md:p-12 text-center transition-all duration-500 ${stat.hover} hover:-translate-y-2 group overflow-hidden relative`}
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
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/30 via-card to-accent/30 border-2 border-primary/40 rounded-3xl md:rounded-[3rem] p-8 sm:p-12 md:p-16 text-center shadow-[0_0_100px_-20px_rgba(var(--primary-rgb),0.3)]">
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
                {user ? `Start Chatting, ${user.full_name?.split(" ")[0] || "Creator"}` : "Collaboration Starts Here"}
              </h3>
              <p className="text-lg sm:text-xl text-foreground/80 font-medium mb-8 md:mb-10 max-w-3xl mx-auto leading-relaxed">
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
                      <Link to="/explore" className="w-full sm:w-auto">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-2xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold border-border hover:bg-secondary transition-all hover:scale-105 backdrop-blur-md bg-card/50">
                          <Compass className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                          Explore Tracks
                        </Button>
                      </Link>
                    </>
                  ) : (
                  <>
                    <Link to="/register" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full sm:w-auto rounded-xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary transition-all hover:scale-105 shadow-xl shadow-primary/30">
                        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                        Start Chatting Free
                        <ArrowRight className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3" />
                      </Button>
                    </Link>
                    <Link to="/explore" className="w-full sm:w-auto">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-2xl h-14 md:h-16 px-6 md:px-10 text-lg md:text-xl font-bold border-border hover:bg-secondary transition-all hover:scale-105 backdrop-blur-md bg-card/50">
                        <Compass className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
                        Explore Tracks
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              {!user && (
                <p className="mt-8 text-sm font-bold text-muted-foreground tracking-wide uppercase">
                  ✨ Completely free messaging · No credit card required ✨
                </p>
              )}
            </div>
          </div>
        </motion.div>

      </section>
    </div>
  );
}