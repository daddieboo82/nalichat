import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquare, Compass, Mic, Wand2, BarChart3,
  Trophy, FileText, Users, Sparkles, ArrowRight
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { sounds } from "@/hooks/use-sound";
import { useLockedChats } from "@/lib/LockedChatsContext";
import { countVisibleUnreadConversations } from "@/lib/lockedChatPolicy";

const QUICK_ITEMS = [
  { icon: MessageSquare, label: "Messages", path: "/messages", gradient: "from-primary to-pink-500", desc: "Chat & collaborate" },
  { icon: Mic, label: "Studio", path: "/studio", gradient: "from-accent to-cyan-500", desc: "Produce tracks" },
  { icon: Compass, label: "Explore", path: "/explore", gradient: "from-blue-500 to-indigo-500", desc: "Discover music" },
  { icon: Wand2, label: "Cover Art", path: "/cover-art", gradient: "from-yellow-400 to-orange-500", desc: "AI artwork" },
  { icon: Users, label: "Projects", path: "/projects-summary", gradient: "from-teal-500 to-emerald-500", desc: "Manage work" },
  { icon: BarChart3, label: "Analytics", path: "/analytics", gradient: "from-cyan-500 to-blue-500", desc: "Track growth" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard", gradient: "from-pink-500 to-rose-500", desc: "Top creators" },
  { icon: FileText, label: "Files", path: "/files", gradient: "from-violet-500 to-purple-500", desc: "Shared files" },
];

export default function QuickAccessGrid() {
  const { user } = useAuth();
  const { isReady, lockedConversationIds } = useLockedChats();

  // Fetch unread message count for badge
  const { data: unreadCount } = useQuery({
    queryKey: ["quick-access-unread", user?.id, ...lockedConversationIds],
    queryFn: async () => {
      try {
        const conversations = await base44.entities.Conversation.list();
        return countVisibleUnreadConversations(
          conversations,
          user?.id,
          lockedConversationIds,
          (conversationId) => {
          try {
              const value = localStorage.getItem(`lastReadAt:${conversationId}`);
              return value ? parseInt(value, 10) : 0;
            } catch {
              return 0;
            }
          },
        );
      } catch { return 0; }
    },
    enabled: !!user?.id && isReady,
    staleTime: 30000,
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 max-w-7xl mx-auto px-6 -mt-16 mb-12"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-xl text-foreground">Quick Access</h2>
        <span className="text-sm text-muted-foreground">— jump right in</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {QUICK_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const showBadge = isReady && item.path === "/messages" && unreadCount > 0;
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Link
                to={item.path}
                onClick={() => sounds.nav()}
                className="group relative block rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-card/70 hover:shadow-lg overflow-hidden"
              >
                <div className={`absolute -inset-10 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-[0.06] blur-2xl transition-opacity duration-500`} />

                {showBadge && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center shadow-lg z-10">
                    {unreadCount}
                  </span>
                )}

                <div className="relative z-10 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110 shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-sm text-foreground truncate">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}