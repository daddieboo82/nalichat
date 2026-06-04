import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Music, Users, Mic, BarChart3, Sparkles, Trophy, Compass, Play, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: MessageSquare,
    label: "Messages",
    path: "/messages",
    description: "Connect with artists & producers",
    gradient: "from-primary to-primary/50",
  },
  {
    icon: Music,
    label: "Playlists",
    path: "/playlists",
    description: "Curate & share collections",
    gradient: "from-accent to-accent/50",
  },
  {
    icon: Mic,
    label: "Studio",
    path: "/studio",
    description: "Multi-track production",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    icon: Sparkles,
    label: "AI Editor",
    path: "/studio-editor",
    description: "AI mastering & analysis",
    gradient: "from-yellow-500 to-orange-500",
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
    description: "Compete & showcase talent",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: Users,
    label: "Network",
    path: "/network",
    description: "Discover collaborators",
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[400px] flex items-center justify-center overflow-hidden px-6 py-12">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-float-blob" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-float-blob" style={{ animationDelay: "-5s" }} />
          <div className="absolute top-1/3 left-1/2 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl animate-float-blob" style={{ animationDelay: "-9s" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-3xl"
        >
          <div className="mb-6 inline-block">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-pink-500 to-accent flex items-center justify-center glow-primary"
            >
              <Music className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          {user && (
            <p className="text-sm font-semibold tracking-wide text-primary mb-3 uppercase">
              Welcome back, {user.full_name?.split(" ")[0] || "Artist"} 🎧
            </p>
          )}
          <h1 className="font-heading font-black text-5xl md:text-7xl mb-4 text-gradient-animate">
            Welcome to NaliChat
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            The ultimate platform for music artists to create, collaborate, and connect. From studio production to live collaboration—everything you need in one beautiful space.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            {user ? (
              <>
                <Link to="/messages">
                  <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Start Messaging
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/studio">
                  <Button size="lg" variant="outline" className="rounded-xl text-base">
                    <Mic className="w-5 h-5 mr-2" />
                    Open Studio
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-base glow-primary shimmer-hover">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Join Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="rounded-xl text-base">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </section>

      {/* Main Content */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Messaging Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <Link to="/messages">
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 p-8 md:p-12 hover:border-primary/40 transition-all duration-300 cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-heading font-bold text-3xl md:text-4xl mb-2 flex items-center gap-3">
                      <MessageSquare className="w-8 h-8 text-primary" />
                      Connect & Collaborate
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Real-time messaging with artists, producers, and engineers. Build your creative network.
                    </p>
                  </div>
                  <Play className="w-12 h-12 text-primary/30 group-hover:text-primary/60 transition-colors" />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div className="bg-primary/10 rounded-xl p-4">
                    <p className="text-2xl font-bold text-primary mb-1">1000+</p>
                    <p className="text-sm text-muted-foreground">Active Collaborators</p>
                  </div>
                  <div className="bg-accent/10 rounded-xl p-4">
                    <p className="text-2xl font-bold text-accent mb-1">Real-time</p>
                    <p className="text-sm text-muted-foreground">Instant Updates</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl p-4">
                    <p className="text-2xl font-bold text-purple-500 mb-1">24/7</p>
                    <p className="text-sm text-muted-foreground">Always Connected</p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Nali AI Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card to-accent/15 border border-primary/20 p-8 md:p-10">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading font-bold text-2xl md:text-3xl mb-1">Meet Nali, your AI partner</h2>
                <p className="text-muted-foreground">
                  Ask anything, get expert music advice, and let Nali <span className="text-foreground font-medium">automate tasks</span> — create projects, build playlists, write your bio, and more. Tap the ✨ button anytime.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="mb-8">
          <h2 className="font-heading font-bold text-3xl mb-2 text-gradient-animate inline-block">Explore All Features</h2>
          <p className="text-muted-foreground mb-8">Everything you need to create, produce, and share your music</p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.path} variants={itemVariants}>
                  <Link to={feature.path}>
                    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 h-full transition-transform duration-300 hover:-translate-y-1`}>
                      <div className="relative h-full bg-card rounded-2xl p-6 transition-all duration-300 shimmer-hover">
                        <div className={`absolute -inset-8 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-300`} />
                        
                        <div className="relative z-10">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="font-heading font-bold text-lg mb-1">{feature.label}</h3>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16"
        >
          <div className="bg-card border border-border rounded-2xl p-8 text-center transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:glow-primary">
            <p className="text-5xl font-black mb-2 bg-gradient-to-br from-primary to-pink-500 bg-clip-text text-transparent">10K+</p>
            <p className="text-muted-foreground">Tracks Uploaded</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center transition-all duration-300 hover:border-accent/50 hover:-translate-y-1 hover:glow-accent">
            <p className="text-5xl font-black mb-2 bg-gradient-to-br from-accent to-cyan-400 bg-clip-text text-transparent">50K+</p>
            <p className="text-muted-foreground">Community Members</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center transition-all duration-300 hover:border-pink-500/50 hover:-translate-y-1">
            <p className="text-5xl font-black mb-2 bg-gradient-to-br from-pink-500 to-purple-500 bg-clip-text text-transparent">1M+</p>
            <p className="text-muted-foreground">Messages Sent</p>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mt-16 mb-12 text-center"
        >
          <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/30 rounded-2xl p-12">
            <h3 className="font-heading font-bold text-3xl mb-4">Ready to Create?</h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {user ? `Welcome back, ${user.full_name}! Start your creative journey.` : "Join thousands of artists creating together."}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              {user ? (
                <>
                  <Link to="/studio">
                    <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90">
                      <Mic className="w-5 h-5 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                  <Link to="/explore">
                    <Button size="lg" variant="outline" className="rounded-xl">
                      <Compass className="w-5 h-5 mr-2" />
                      Explore Tracks
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90">
                      <Sparkles className="w-5 h-5 mr-2" />
                      Get Started Free
                    </Button>
                  </Link>
                  <Link to="/explore">
                    <Button size="lg" variant="outline" className="rounded-xl">
                      <Compass className="w-5 h-5 mr-2" />
                      Explore Tracks
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}