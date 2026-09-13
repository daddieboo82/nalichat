import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, MessageSquare, Compass, ArrowRight, Users, Mic } from 'lucide-react';

const quickStarts = [
  {
    icon: Mic,
    title: 'Open Studio',
    desc: 'Produce & record tracks',
    link: '/studio',
    bgClass: 'bg-gradient-to-br from-primary to-pink-500',
  },
  {
    icon: Compass,
    title: 'Explore Music',
    desc: 'Discover tracks & artists',
    link: '/explore',
    bgClass: 'bg-gradient-to-br from-pink-500 to-rose-500',
  },
  {
    icon: MessageSquare,
    title: 'Connect & Chat',
    desc: 'Collaborate with creators',
    link: '/messages',
    bgClass: 'bg-gradient-to-br from-blue-500 to-purple-500',
  },
  {
    icon: Users,
    title: 'Find Collaborators',
    desc: 'Grow your network',
    link: '/explore',
    bgClass: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
];

export default function QuickStartGuide() {
  return (
    <div className="ui-surface mb-10 rounded-3xl border border-border/50 bg-gradient-to-br from-secondary/50 to-card p-5 sm:mb-12 sm:p-8">
      <div className="mb-4 flex items-center gap-3 sm:mb-6">
        <Sparkles className="w-6 h-6 text-primary" />
        <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Quick Start</h2>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-foreground/90 sm:mb-6 sm:text-base">Get started in seconds with these key features</p>
      
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickStarts.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={item.link}
                className={`ui-hover group block min-h-[118px] h-full w-full rounded-2xl ${item.bgClass} p-4 text-left text-white transition-all hover:shadow-lg hover:shadow-current/20 focus-visible:ring-2 focus-visible:ring-white/60`}
              >
                <Icon className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-xs opacity-90">{item.desc}</p>
                <ArrowRight className="mt-2 h-4 w-4 opacity-70 transition-opacity group-hover:opacity-100" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}