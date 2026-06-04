import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Music, MessageSquare, Compass, ArrowRight, Users, Mic } from 'lucide-react';

const quickStarts = [
  {
    icon: Mic,
    title: 'Open Studio',
    desc: 'Produce & record tracks',
    link: '/studio',
    color: 'from-primary to-pink-500',
  },
  {
    icon: Compass,
    title: 'Explore Music',
    desc: 'Discover tracks & artists',
    link: '/explore',
    color: 'from-pink-500 to-red-500',
  },
  {
    icon: MessageSquare,
    title: 'Connect & Chat',
    desc: 'Collaborate with creators',
    link: '/messages',
    color: 'from-blue-500 to-purple-500',
  },
  {
    icon: Users,
    title: 'Find Collaborators',
    desc: 'Grow your network',
    link: '/network',
    color: 'from-green-500 to-teal-500',
  },
];

export default function QuickStartGuide() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-secondary/50 to-card border border-border/50 p-8 mb-12">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold">Quick Start</h2>
      </div>
      <p className="text-muted-foreground mb-6">Get started in seconds with these key features</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {quickStarts.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Link to={item.link}>
                <button className={`w-full h-full bg-gradient-to-br ${item.color} rounded-xl p-4 text-white hover:shadow-lg hover:shadow-current/30 transition-all hover:scale-105 group text-left`}>
                  <Icon className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs opacity-80">{item.desc}</p>
                  <ArrowRight className="w-3.5 h-3.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}