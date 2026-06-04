import { motion } from "framer-motion";
import { ArrowRight, Mic, Users, Upload, Music } from "lucide-react";
import { Link } from "react-router-dom";

const quickWins = [
  {
    icon: Upload,
    title: "Upload & Release",
    description: "Share your track on Explore in 30 seconds",
    action: "Release Now",
    path: "/explore",
    color: "from-primary to-pink-500",
    emoji: "🚀"
  },
  {
    icon: Users,
    title: "Connect & Collaborate",
    description: "Message producers and start a session",
    action: "Start Messaging",
    path: "/messages",
    color: "from-accent to-cyan-400",
    emoji: "🤝"
  },
  {
    icon: Mic,
    title: "Build Multi-Track Sessions",
    description: "Start your first studio project",
    action: "Open Studio",
    path: "/studio",
    color: "from-purple-500 to-purple-600",
    emoji: "🎚️"
  },
  {
    icon: Music,
    title: "Discover Sounds",
    description: "Browse tracks from creators worldwide",
    action: "Explore Tracks",
    path: "/explore",
    color: "from-indigo-500 to-purple-500",
    emoji: "🎵"
  }
];

export default function QuickWinsCarousel({ user }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative">
        <div className="mb-6">
          <h2 className="font-heading font-bold text-3xl mb-2">Start Creating in Seconds</h2>
          <p className="text-muted-foreground text-lg">Pick what excites you most</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickWins.map((win, i) => {
            const Icon = win.icon;
            return (
              <motion.div
                key={win.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link to={win.path}>
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${win.color} p-0.5 h-full transition-all duration-300 hover:shadow-xl`}>
                    <div className="relative h-full bg-card rounded-2xl p-5 flex flex-col">
                      <div className="text-3xl mb-3">{win.emoji}</div>
                      <h3 className="font-heading font-bold text-base mb-1 flex-1">{win.title}</h3>
                      <p className="text-xs text-muted-foreground mb-4">{win.description}</p>
                      <div className="flex items-center gap-1 text-xs font-semibold text-foreground/70 group opacity-0 hover:opacity-100 transition-opacity">
                        {win.action} <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}