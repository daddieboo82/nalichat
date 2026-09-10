import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Home, Compass, MessageSquare, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { sounds } from "@/hooks/use-sound";

const TABS = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Plus, label: "New Project", path: "/projects-summary?new=true", isAction: true },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: User, label: "Profile", path: "/profile" },
];

const STORAGE_KEY = "mobile_nav_stacks";

function getTabForPath(pathname) {
  if (pathname === "/" || pathname.startsWith("/playlist")) return "/";
  if (pathname.startsWith("/explore")) return "/explore";
  if (pathname.startsWith("/messages")) return "/messages";
  if (pathname.startsWith("/profile")) return "/profile";
  return null;
}

function loadStacks() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

function saveStacks(stacks) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stacks)); } catch {}
}

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const currentEntry = path + location.search;

  const isActive = (tabPath) => tabPath === "/" ? path === "/" : path.startsWith(tabPath);

  const [stacks, setStacks] = useState(loadStacks);
  const activeTabRef = useRef(getTabForPath(path));

  // Track which tab is active and push navigation entries to the correct tab stack
  useEffect(() => {
    const tab = getTabForPath(path);
    if (tab === null) return; // Pages not owned by any tab (e.g. /studio, /settings) don't modify stacks

    const prev = activeTabRef.current;
    activeTabRef.current = tab;

    setStacks(prevStacks => {
      const next = { ...prevStacks };
      const stack = next[tab] || [tab];

      // If switching to a different tab, don't push — just let the restore handle it
      if (prev !== null && prev !== tab) {
        return prevStacks;
      }

      // Same tab navigation: push the new entry if it's different from the last one
      const last = stack[stack.length - 1];
      if (last !== currentEntry) {
        // If the new entry is the tab root, reset the stack (user navigated "home" within the tab)
        if (currentEntry === tab || currentEntry === tab + location.search) {
          next[tab] = [currentEntry];
        } else {
          next[tab] = [...stack, currentEntry];
        }
      }
      saveStacks(next);
      return next;
    });
  }, [path, location.search]);

  const handleTap = (tabPath) => {
    const active = isActive(tabPath);
    sounds.click();

    if (active) {
      // Tapping the active tab: if not at root, go back to root; otherwise scroll to top
      const stack = stacks[tabPath] || [tabPath];
      if (stack.length > 1) {
        // Pop back to root of this tab
        const newStack = [stack[0]];
        const next = { ...stacks, [tabPath]: newStack };
        setStacks(next);
        saveStacks(next);
        navigate(newStack[0]);
      } else {
        const scroller = document.querySelector("main");
        scroller?.scrollTo?.({ top: 0, behavior: "smooth" });
      }
      return;
    }

    // Switching to a different tab: restore the last entry in that tab's stack
    const stack = stacks[tabPath] || [tabPath];
    const target = stack[stack.length - 1] || tabPath;
    navigate(target);
  };

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/90 backdrop-blur-md select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {TABS.map(({ icon: Icon, label, path: tabPath, isAction }) => {
          const active = isActive(tabPath);
          
          if (isAction) {
            return (
              <div key={tabPath} className="relative flex-1 flex items-center justify-center pt-1 pb-2">
                <button
                  onClick={() => handleTap(tabPath)}
                  title={label}
                  aria-label={label}
                  className="absolute -top-4 w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-pink-500 flex items-center justify-center text-white shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  <Icon className="w-6 h-6" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tabPath}
              onClick={() => handleTap(tabPath)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 select-none transition-colors active:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="mobileNavPill"
                  className="absolute inset-x-2 top-1 bottom-1 rounded-2xl bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <motion.div
                className="relative z-10"
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
              <span className="relative z-10 text-[11px] font-medium leading-tight w-full text-center truncate px-0.5">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}