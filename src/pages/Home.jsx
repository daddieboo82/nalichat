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
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" />
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
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30"
            >
              <Music className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          <h1 className="font-heading font-black text-5xl md:text-7xl mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Welcome to NaliChat
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            The ultimate platform for music artists to create, collaborate, and connect. From studio production to live collaboration—everything you need in one beautiful space.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/messages">
              <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90 text-base">
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

        {/* Features Grid */}
        <div className="mb-8">
          <h2 className="font-heading font-bold text-3xl mb-2">Explore All Features</h2>
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
                    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 h-full`}>
                      <div className="relative h-full bg-card rounded-2xl p-6 hover:bg-card/50 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative z-10">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}>
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
          <div className="bg-card border border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-colors">
            <p className="text-4xl font-bold text-primary mb-2">10K+</p>
            <p className="text-muted-foreground">Tracks Uploaded</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center hover:border-accent/40 transition-colors">
            <p className="text-4xl font-bold text-accent mb-2">50K+</p>
            <p className="text-muted-foreground">Community Members</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center hover:border-purple-500/40 transition-colors">
            <p className="text-4xl font-bold text-purple-500 mb-2">1M+</p>
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
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}