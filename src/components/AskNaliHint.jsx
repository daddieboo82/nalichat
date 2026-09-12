import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowDown } from "lucide-react";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/onboarding", "/studio"];

// Shows a tiny glowing arrow hint nudging the user to "Ask Nali"
// after a period of inactivity (user seems stuck / idle).
const IDLE_MS = 20000; // 20s of no interaction

function sessionGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function sessionSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

export default function AskNaliHint() {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  const location = useLocation();
  const onAuthPage = AUTH_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (onAuthPage) {
      setShow(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    const dismissedForever = sessionGet("nali_hint_dismissed");

    const reset = () => {
      setShow(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (sessionGet("nali_hint_dismissed")) return;
      timerRef.current = setTimeout(() => setShow(true), IDLE_MS);
    };

    if (!dismissedForever) {
      ["mousemove", "keydown", "touchstart", "scroll", "click"].forEach((e) =>
        window.addEventListener(e, reset, { passive: true })
      );
      reset();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ["mousemove", "keydown", "touchstart", "scroll", "click"].forEach((e) =>
        window.removeEventListener(e, reset)
      );
    };
  }, [onAuthPage]);

  const askNali = () => {
    setShow(false);
    sessionSet("nali_hint_dismissed", "1");
    window.dispatchEvent(new Event("open-ai-assistant"));
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          onClick={askNali}
          initial={{ opacity: 0, x: 20, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.8 }}
          className="fixed bottom-32 md:bottom-20 right-4 z-[999998] flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-card/90 backdrop-blur-md border border-primary/40 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
        >
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
          <Sparkles className="relative w-3.5 h-3.5 text-primary" />
          <span className="relative text-xs font-bold text-foreground whitespace-nowrap">Stuck? Ask Nali</span>
          <motion.span
            className="relative text-primary"
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}