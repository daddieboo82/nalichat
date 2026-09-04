import { motion } from "framer-motion";
import { AudioLines } from "lucide-react";
import { useNaliPresence } from "@/lib/NaliPresenceContext";
import { cn } from "@/lib/utils";

const SIZES = { sm: "w-7 h-7", md: "w-9 h-9", lg: "w-11 h-11" };
const ICON_SIZES = { sm: "w-3.5 h-3.5", md: "w-5 h-5", lg: "w-6 h-6" };

// A subtle, omnipresent Nali orb that can be embedded in any surface.
// Clicking summons the main Nali assistant with optional context.
export default function NaliPresenceIndicator({ surface = "global", size = "sm", className, greeting }) {
  const { isMuted } = useNaliPresence();
  if (isMuted) return null;

  const open = () => {
    window.dispatchEvent(new CustomEvent("open-ai-assistant", { detail: { greeting } }));
  };

  return (
    <motion.button
      onClick={open}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      title="Ask Nali"
      aria-label="Ask Nali"
      data-nali-surface={surface}
      className={cn(
        "relative rounded-full border border-primary/40 bg-card flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.25)]",
        SIZES[size],
        className
      )}
    >
      <span className="absolute inset-0 rounded-full bg-primary/15 animate-ping pointer-events-none" style={{ animationDuration: "3s" }} />
      <AudioLines className={cn("relative text-primary", ICON_SIZES[size])} />
    </motion.button>
  );
}