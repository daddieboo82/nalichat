import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { getRememberedWorldForPath, getWorldForPath, WORLD_CONTEXTS } from "@/lib/nalibaseWorldContext";

const LEGACY_STORAGE_KEY = "nali_recent_pages";
const storageKeyFor = (userId) => `nali_recent_pages:${userId || "anonymous"}`;
const MAX_ITEMS = 4;
// Paths that shouldn't be tracked (transient/auth pages)
const EXCLUDE = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/onboarding"];

const ICONS = {
  "/": "🏠",
  "/explore": "🧭",
  "/studio": "🎙️",
  "/messages": "💬",
  "/profile": "👤",
  "/playlists": "🎵",
  "/files": "📁",
  "/leaderboard": "🏆",
  "/analytics": "📊",
  "/record": "📻",
  "/cover-art": "🎨",
  "/challenges": "⚔️",
  "/projects-summary": "📋",
  "/viral-seed": "🚀",
  "/squad": "🤝",
  "/settings": "⚙️",
  "/pricing": "💎",
};

const normalizeEntry = (item) => typeof item === "string"
  ? { path: item, fromWorld: "" }
  : { path: item?.path || "", fromWorld: WORLD_CONTEXTS[item?.fromWorld] ? item.fromWorld : "" };

export default function RecentlyVisited({ onNavigate, currentPath, currentWorldId = "" }) {
  const { user } = useAuth();
  const storageKey = storageKeyFor(user?.id);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    try {
      let raw = sessionStorage.getItem(storageKey);
      if (!raw && !user?.id) {
        raw = sessionStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          sessionStorage.setItem(storageKey, raw);
          sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
      const parsed = JSON.parse(raw || "[]");
      // Migrate legacy path strings to origin-aware entries and remove Plaza.
      const cleaned = parsed.map(normalizeEntry).filter(entry => entry.path && entry.path !== "/");
      if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) sessionStorage.setItem(storageKey, JSON.stringify(cleaned));
      setRecent(cleaned);
    } catch { setRecent([]); }
  }, [currentPath, storageKey, user?.id]);

  // Track current page (skip excluded + detail/sub pages)
  useEffect(() => {
    if (EXCLUDE.some(p => currentPath.startsWith(p))) return;
    // Only track root-level pages (no dynamic segments)
    if (currentPath.split("/").filter(Boolean).length > 1) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "[]").map(normalizeEntry);
      const filtered = stored.filter(entry => entry.path !== currentPath);
      const entry = { path: currentPath, fromWorld: WORLD_CONTEXTS[currentWorldId] ? currentWorldId : "" };
      const updated = [entry, ...filtered].slice(0, MAX_ITEMS);
      sessionStorage.setItem(storageKey, JSON.stringify(updated));
      setRecent(updated);
    } catch {}
  }, [currentPath, currentWorldId, storageKey]);

  if (recent.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1 flex items-center gap-1.5">
        <Clock className="w-3 h-3" /> Recent
      </h3>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {recent.map(entry => {
          const { path, fromWorld } = normalizeEntry(entry);
          const rememberedWorld = fromWorld || getRememberedWorldForPath(path);
          const world = getWorldForPath(path, rememberedWorld);
          return (
          <button
            key={`${path}:${fromWorld}`}
            onClick={() => onNavigate(path, world?.id || '')}
            className={cn(
              "ui-hover flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
              path === currentPath
                ? "bg-primary/15 text-primary border border-primary/20"
                : "bg-secondary/60 text-foreground hover:bg-secondary"
            )}
          >
            <span className="text-sm">{ICONS[path] || "📄"}</span>
            <span className="capitalize">{path.split("/")[1].replace(/-/g, " ")}</span>
          </button>
          );
        })}
      </div>
    </div>
  );
}