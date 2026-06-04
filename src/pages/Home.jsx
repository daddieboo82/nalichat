import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Music, Users, Mic, BarChart3, Sparkles,
  Trophy, Compass, Play, ArrowRight, Zap, Shield, Star,
  Headphones, Radio, Wand2, FileAudio, ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";
import DailyRecommendation from "@/components/home/DailyRecommendation";
import QuickStartGuide from "@/components/home/QuickStartGuide";
import { sounds } from "@/hooks/use-sound";

const features = [
  {
    icon: MessageSquare,
    label: "Messages",
    path: "/messages",
    description: "Real-time chat with artists & producers",
    gradient: "from-primary to-primary/50",
    badge: "Live",
  },
  {
    icon: Music,
    label: "Playlists",
    path: "/playlists",
    description: "Curate & share your sound",
    gradient: "from-accent to-accent/50",
  },
  {
    icon: Mic,
    label: "Studio",
    path: "/studio",
    description: "Multi-track production workspace",
    gradient: "from-purple-500 to-purple-600",
    badge: "Pro",
  },
  {
    icon: Sparkles,
    label: "AI Editor",
    path: "/studio-editor",
    description: "AI mastering & stem analysis",
    gradient: "from-yellow-500 to-orange-500",
    badge: "AI",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    path: "/analytics",
    description: "Track engagement & growth",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: Trophy,
    label: "Leaderboard",
    path: "/leaderboard",
    description: "Compete & showcase your talent",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: Users,
    label: "Network",
    path: "/network",
    description: "Find your next collaborator",
    gradient: "from-lime-500 to-green-500",
  },
  {
    icon: Compass,
    label: "Explore",
    path: "/explore",
    description: "Browse trending tracks",
    gradient: "from-indigo-500 to-purple-500",
  },
];

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Create Your Profile",
    description: "Set up your artist profile, add your genre, skills, and let the community discover you.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    number: "02",
    icon: Mic,
    title: "Build in the Studio",
    description: "Upload stems, record ideas, and collaborate on multi-track sessions with others in real time.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Let AI Enhance It",
    description: "Use Nali AI to master your tracks, generate artist bios, suggest tags, and automate tasks.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    number: "04",
    icon: Radio,
    title: "Share & Grow",
    description: "Post to Explore, climb the leaderboard, build playlists, and watch your audience expand.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
];

const testimonials = [
  {
    name: "Jordan K.",
    role: "Producer",
    avatar: "J",
    color: "from-primary to-pink-500",
    quote: "NaliChat completely changed how I collaborate. I finished 3 tracks this month I never would have alone.",
  },
  {
    name: "Amara S.",
    role: "Singer-Songwriter",
    avatar: "A",
    color: "from-accent to-cyan-400",
    quote: "The AI mastering is insane. My demos sound professional before I even send them to a mixer.",
  },
  {
    name: "Dre M.",
    role: "Beatmaker",
    avatar: "D",
    color: "from-yellow-500 to-orange-500",
    quote: "Found my whole team here — vocalist, mixing engineer, and a manager. All in one app.",
  },
];

const pillars = [
  { icon: Zap, label: "Real-time collaboration", color: "text-yellow-400" },
  { icon: Shield, label: "Your files, your rights", color: "text-green-400" },
  { icon: Star, label: "AI-powered tools", color: "text-purple-400" },
  { icon: Headphones, label: "Studio-quality audio", color: "text-accent" },
  { icon: FileAudio, label: "Multi-format support", color: "text-pink-400" },
  { icon: Wand2, label: "One-click mastering", color: "text-primary" },
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
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="h-full overflow-auto bg-background">

      {/* ── Daily Recommendation ── */}
      <DailyRecommendation />

      {/* ── Hero ── */}
      <section className="relative min-h-[520px] flex items-center justify-center overflow-hidden px-6 py-16">
        {/* Animated blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl animate-float-blob" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-accent/25 rounded-full blur-3xl animate-float-blob" style={{ animationDelay: "-5s" }} />
          <div className="absolute top-1/3 left-1/2 w-80 h-80 bg-pink-500/15 rounded-full blur-3xl animate-float-blob" style={{ animationDelay: "-9s" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-4xl"
        >
          {/* Logo icon */}
          <div className="mb-6 flex justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary via-pink-500 to-accent flex items-center justify-center glow-primary shadow-2xl"
            >
              <Music className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Personalized greeting */}
          {user && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-semibold tracking-widest text-primary mb-3 uppercase"
            >
              Welcome back, {user.full_name?.split(" ")[0] || "Artist"} 🎧
            </motion.p>
          )}

          {!user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-5"
            >
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              The music collaboration platform
            </motion.div>
          )}

          <h1 className="font-heading font-black text-5xl md:text-7xl mb-5 text-gradient-animate leading-tight">
            Make Music.<br className="hidden md:block" /> Together.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            NaliChat brings artists, producers, and engineers into one creative universe. Record, collaborate, master with AI, and share your sound with the world.
          </p>

          {/* CTAs */}
          <div className="flex gap-4 justify-center flex-wrap">
            {user ? (
              <>
                <Link to="/messages">
                  <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover px-7">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Start Messaging
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/studio">
                  <Button size="lg" variant="outline" className="rounded-xl text-base px-7">
                    <Mic className="w-5 h-5 mr-2" />
                    Open Studio
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover px-7">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Join Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button size="lg" variant="outline" className="rounded-xl text-base px-7">
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
              Free forever · No credit card · 50K+ artists already inside
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
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 p-8 md:p-12 hover:border-primary/40 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/8 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold tracking-widest text-primary uppercase bg-primary/10 px-3 py-1 rounded-full">Live Collaboration</span>
                  </div>
                  <h2 className="font-heading font-bold text-3xl md:text-4xl mb-3 flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-primary shrink-0" />
                    Connect & Create Together
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6 max-w-xl">
                    Real-time messaging, voice notes, file sharing, and session coordination — all in one place. Build your creative circle and move fast.
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
                  <span className="text-xs font-bold tracking-widest text-yellow-400 uppercase bg-yellow-400/10 px-3 py-1 rounded-full">Powered by AI</span>
                </div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl mb-2">Meet Nali, your AI music partner</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ask anything, get expert music advice, and let Nali{" "}
                  <span className="text-foreground font-semibold">automate the boring stuff</span> — create projects, master tracks, write your bio, build playlists, and more.
                  Just tap the <span className="text-primary font-bold">✨</span> button anywhere in the app.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Features Grid ── */}
        <div>
          <div className="mb-10">
            <h2 className="font-heading font-bold text-4xl mb-3 text-gradient-animate inline-block">Everything You Need</h2>
            <p className="text-muted-foreground text-lg">One platform. Every tool a music creator could want.</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.path} variants={itemVariants}>
                  <Link to={feature.path} onClick={() => sounds.click()}>
                    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 h-full transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl`}>
                      <div className="relative h-full bg-card rounded-2xl p-6 shimmer-hover">
                        <div className={`absolute -inset-8 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-15 blur-2xl transition-opacity duration-300`} />
                        <div className="relative z-10">
                          {feature.badge && (
                            <span className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${feature.gradient} text-white`}>
                              {feature.badge}
                            </span>
                          )}
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="font-heading font-bold text-lg mb-1">{feature.label}</h3>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                          <div className="flex items-center gap-1 mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity text-foreground/70">
                            Open <ChevronRight className="w-3 h-3" />
                          </div>
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
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-4xl mb-3">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">From zero to released — NaliChat covers every step of your creative process.</p>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
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
            <h2 className="font-heading font-bold text-4xl mb-3">Loved by Creators</h2>
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
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm`}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            { value: "10K+", label: "Tracks Uploaded", from: "from-primary", to: "to-pink-500", hover: "hover:border-primary/50 hover:glow-primary" },
            { value: "50K+", label: "Community Members", from: "from-accent", to: "to-cyan-400", hover: "hover:border-accent/50 hover:glow-accent" },
            { value: "1M+", label: "Messages Sent", from: "from-pink-500", to: "to-purple-500", hover: "hover:border-pink-500/50" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-card border border-border rounded-2xl p-10 text-center transition-all duration-300 ${stat.hover} hover:-translate-y-1`}
            >
              <p className={`text-6xl font-black mb-2 bg-gradient-to-br ${stat.from} ${stat.to} bg-clip-text text-transparent`}>{stat.value}</p>
              <p className="text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Final CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-card to-accent/20 border border-primary/30 rounded-3xl p-12 text-center">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-accent/15 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center glow-primary">
                <Music className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-heading font-black text-4xl md:text-5xl mb-4">
                {user ? `Keep Creating, ${user.full_name?.split(" ")[0] || "Artist"}` : "Your Music Deserves a Stage"}
              </h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                {user
                  ? "Your studio, your collaborators, and your AI partner are all waiting."
                  : "Join thousands of artists already creating, collaborating, and growing on NaliChat — completely free."}
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                {user ? (
                  <>
                    <Link to="/studio">
                      <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 px-8">
                        <Mic className="w-5 h-5 mr-2" />
                        Open Studio
                      </Button>
                    </Link>
                    <Link to="/explore">
                      <Button size="lg" variant="outline" className="rounded-xl px-8">
                        <Compass className="w-5 h-5 mr-2" />
                        Explore Tracks
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register">
                      <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 px-8 text-base glow-primary">
                        <Sparkles className="w-5 h-5 mr-2" />
                        Get Started Free
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                    <Link to="/explore">
                      <Button size="lg" variant="outline" className="rounded-xl px-8">
                        <Compass className="w-5 h-5 mr-2" />
                        Explore Tracks
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              {!user && (
                <p className="mt-5 text-sm text-muted-foreground">No credit card required · Cancel anytime</p>
              )}
            </div>
          </div>
        </motion.div>

      </section>
    </div>
  );
}