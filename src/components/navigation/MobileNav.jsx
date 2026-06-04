import { useLocation, useNavigate } from "react-router-dom";
import { Home, Compass, MessageSquare, User, Settings, Mic, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { sounds } from "@/hooks/use-sound";

const TABS = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: Wand2, label: "AI Cover", path: "/cover-art" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (tabPath) => tabPath === "/" ? path === "/" : path.startsWith(tabPath);

  const handleTap = (tabPath) => {
    const active = isActive(tabPath);
    sounds.click();
    if (active) {
      const scroller = document.querySelector("main");
      scroller?.scrollTo?.({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(tabPath);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/90 backdrop-blur-md select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {TABS.map(({ icon: Icon, label, path: tabPath }) => {
          const active = isActive(tabPath);
          return (
            <button
              key={tabPath}
              onClick={() => handleTap(tabPath)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 select-none transition-colors active:bg-primary/10",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <motion.div
                animate={active ? { scale: [1, 1.25, 1.1], y: [0, -3, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {active && (
                  <motion.div
                    className="absolute w-8 h-8 rounded-full bg-primary/20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
                <Icon className="w-5 h-5" />
              </motion.div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}