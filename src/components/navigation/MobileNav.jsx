import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Home, Compass, MessageSquare, Music, Trophy, Film, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { sounds } from "@/hooks/use-sound";
import { useAuth } from "@/lib/AuthContext";
import { resolveWorldForLocation } from "@/lib/nalibaseWorldContext";

const TABS = [
  { icon: Home, label: "Plaza", path: "/" },
  { icon: MessageSquare, label: "Connect", path: "/world/connect" },
  { icon: Music, label: "Create", path: "/world/create" },
  { icon: Compass, label: "Discover", path: "/world/discover" },
  { icon: FolderKanban, label: "Share", path: "/world/share" },
  { icon: Film, label: "Visualize", path: "/world/visualize" },
  { icon: Trophy, label: "Compete", path: "/world/compete" },
];

const LEGACY_STORAGE_KEY = "mobile_nav_stacks";
const storageKeyFor = (userId) => `mobile_nav_stacks:${userId || "anonymous"}`;

function getTabForPath(pathname, preferredWorld = "") {
  if (preferredWorld) return `/world/${preferredWorld}`;
  if (pathname === "/") return "/";
  if (pathname.startsWith("/world/connect") || pathname.startsWith("/messages") || pathname.startsWith("/profile")) return "/world/connect";
  if (pathname.startsWith("/world/create") || pathname.startsWith("/studio") || pathname.startsWith("/record")) return "/world/create";
  if (pathname.startsWith("/world/discover") || pathname.startsWith("/explore") || pathname.startsWith("/playlist") || pathname.startsWith("/analytics")) return "/world/discover";
  if (pathname.startsWith("/world/share") || pathname.startsWith("/files") || pathname.startsWith("/projects-summary")) return "/world/share";
  if (pathname.startsWith("/world/visualize") || pathname.startsWith("/music-video-generator") || pathname.startsWith("/cover-art")) return "/world/visualize";
  if (pathname.startsWith("/world/compete") || pathname.startsWith("/challenge") || pathname.startsWith("/leaderboard") || pathname.startsWith("/squad")) return "/world/compete";
  return null;
}

function loadStacks(storageKey, userId) {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved);
    if (!userId) {
      const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        sessionStorage.setItem(storageKey, legacy);
        sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        return JSON.parse(legacy);
      }
    }
  } catch {}
  return {};
}

function saveStacks(storageKey, stacks) {
  try { sessionStorage.setItem(storageKey, JSON.stringify(stacks)); } catch {}
}

export default function MobileNav() {
  const { user } = useAuth();
  const storageKey = storageKeyFor(user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const currentEntry = path + location.search;

  const activeWorld = resolveWorldForLocation(path, location.state?.fromWorld);
  const isActive = (tabPath) => {
    if (tabPath === "/") return path === "/";
    const worldId = tabPath.startsWith("/world/") ? tabPath.slice(7) : "";
    return path.startsWith(tabPath) || (!!worldId && activeWorld?.id === worldId);
  };

  const [stacks, setStacks] = useState(() => loadStacks(storageKey, user?.id));
  const activeTabRef = useRef(getTabForPath(path, location.state?.fromWorld));

  useEffect(() => {
    setStacks(loadStacks(storageKey, user?.id));
    activeTabRef.current = getTabForPath(path, location.state?.fromWorld);
  }, [storageKey, user?.id, path, location.state?.fromWorld]);

  // Track which tab is active and push navigation entries to the correct tab stack
  useEffect(() => {
    const tab = getTabForPath(path, location.state?.fromWorld);
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
      saveStacks(storageKey, next);
      return next;
    });
  }, [path, location.search, storageKey, location.state?.fromWorld]);

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
        saveStacks(storageKey, next);
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
                active ? "text-foreground" : "text-muted-foreground"
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