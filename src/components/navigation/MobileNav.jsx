import { useLocation, useNavigate } from "react-router-dom";
import { Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { sounds } from "@/hooks/use-sound";
import { PRIMARY_TABS, SECONDARY_PATHS, mobileSectionPath } from "@/lib/navigationConfig";

// 5 simple tabs: Home, Messages, Studio, Explore, More
// "More" opens the full feature menu sheet (handled by MobileHeader).
const TABS = [...PRIMARY_TABS, { icon: Grid3x3, label: "More", path: "__more__" }];

function getActiveTab(pathname) {
  const section = mobileSectionPath(pathname);
  if (PRIMARY_TABS.some(tab => tab.path === section)) return section;
  return SECONDARY_PATHS.has(section) || SECONDARY_PATHS.has(pathname) ? "__more__" : null;
}

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const path = location.pathname;

  const activeTab = getActiveTab(path);

  const handleTap = (tabPath) => {
    sounds.click();
    if (tabPath === "__more__") {
      window.dispatchEvent(new Event("open-mobile-menu"));
      return;
    }
    if (tabPath === path) {
      // Tapping the active tab scrolls to top
      const scroller = document.querySelector("main");
      scroller?.scrollTo?.({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    navigate(tabPath);
  };

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="nali-nav-chrome lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/90 backdrop-blur-md select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {TABS.map(({ icon: Icon, label, path: tabPath }) => {
          const active = tabPath === activeTab;
          const isMore = tabPath === "__more__";

          return (
            <button
              key={tabPath}
              onClick={() => handleTap(tabPath)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "relative flex-1 min-h-12 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 select-none touch-manipulation transition-colors active:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "text-foreground" : "text-muted-foreground",
                isMore && !active && "text-primary"
              )}
            >
              {active && (
                <motion.div
                  layoutId="mobileNavPill"
                  className="absolute inset-x-2 top-1 bottom-1 rounded-2xl bg-primary/10 border border-primary/20"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <motion.div
                className="relative z-10"
                animate={reduceMotion ? { scale: 1, y: 0 } : active ? { scale: [1, 1.25, 1.1], y: [0, -3, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              <span className="relative z-10 text-[11px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}