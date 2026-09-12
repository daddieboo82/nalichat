import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useNaliPresence } from "@/lib/NaliPresenceContext";
import { useSubscription } from "@/hooks/useSubscription";

// Context-aware, proactive-but-muted suggestion chips per surface.
// Only auto-surfaces when the user's level is 'proactive'; always dismissible.
const SURFACE_HINTS = {
  chat: [
    "Nali can summarize this conversation — just ask.",
    "Want a vibe-based playlist from this chat? Ask Nali.",
    "Nali can turn this chat into a lyrical recap.",
    "Ask Nali for music theory tips that fit this vibe.",
  ],
  media: [
    "Nali can suggest tracks that match this vibe.",
    "Ask Nali for production tips on this track.",
  ],
  profile: [
    "Nali can help write your artist bio.",
    "Ask Nali to suggest tags for your tracks.",
  ],
  settings: [
    "Adjust how proactive Nali is from here anytime.",
  ],
};

const DISMISS_KEY = (surface) => `nali_hint_dismissed_${surface}`;

export default function NaliContextHint({ surface = "global", contextLabel, customHint, delayMs = 6000 }) {
  const { hasEntitlement, isLoading } = useSubscription();
  const canUseAi = hasEntitlement("ai.standard");
  const { isProactive, isMuted } = useNaliPresence();
  const [visible, setVisible] = useState(false);

  const hint = useMemo(() => {
    if (customHint) return customHint;
    const pool = SURFACE_HINTS[surface] || [];
    if (!pool.length) return null;
    // Deterministic pick so the hint is stable per context.
    const seed = (contextLabel || surface).length;
    return pool[seed % pool.length];
  }, [surface, contextLabel, customHint]);

  useEffect(() => {
    if (isLoading || !canUseAi || !isProactive || isMuted || !hint) { setVisible(false); return; }
    try { if (sessionStorage.getItem(DISMISS_KEY(surface))) { setVisible(false); return; } } catch {}
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [isLoading, canUseAi, isProactive, isMuted, hint, surface, delayMs]);

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY(surface), "1"); } catch {}
  };

  const act = () => {
    window.dispatchEvent(new CustomEvent("open-ai-assistant", { detail: { greeting: hint } }));
    dismiss();
  };

  return (
    <AnimatePresence>
      {visible && hint && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          className="flex items-center gap-2 max-w-[260px] bg-card/90 backdrop-blur-md border border-primary/30 rounded-full pl-3 pr-1.5 py-1.5 shadow-lg shadow-primary/10"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <button onClick={act} className="text-[11px] text-left text-foreground/90 leading-tight flex-1 line-clamp-2 hover:text-primary transition-colors">
            {hint}
          </button>
          <button onClick={dismiss} className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0" aria-label="Dismiss Nali hint">
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}