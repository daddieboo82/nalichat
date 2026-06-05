import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";

// Shows collaborators currently live in the studio room, with their activity.
export default function LivePresenceBar({ peers }) {
  if (!peers || peers.length === 0) return null;

  const current = peers[0];

  return (
    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl pl-2 pr-3 py-1 shrink-0">
      <div className="flex -space-x-2">
        <AnimatePresence>
          {peers.slice(0, 4).map((p) => (
            <motion.div
              key={p.user_id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
              title={`${p.user_name} — ${p.activity || "In the studio"}`}
            >
              <Avatar className="w-7 h-7 border-2 border-card">
                <AvatarImage src={p.user_avatar} />
                <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
                  {p.user_name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border border-card animate-pulse" />
            </motion.div>
          ))}
        </AnimatePresence>
        {peers.length > 4 && (
          <div className="w-7 h-7 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            +{peers.length - 4}
          </div>
        )}
      </div>
      <div className="hidden md:flex flex-col leading-tight min-w-0">
        <span className="text-[11px] font-semibold text-green-400 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {peers.length} live
        </span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
          {current.user_name}: {current.activity || "In the studio"}
        </span>
      </div>
    </div>
  );
}