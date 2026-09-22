import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

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

export default function RecentlyVisited({ onNavigate, currentPath }) {
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
      // Plaza is a navigation home, not a storefront destination. Remove legacy
      // entries so Recent stays useful after the NaliBase hub migration.
      const cleaned = parsed.filter(path => path !== "/");
      if (cleaned.length !== parsed.length) sessionStorage.setItem(storageKey, JSON.stringify(cleaned));
      setRecent(cleaned);
    } catch { setRecent([]); }
  }, [currentPath, storageKey, user?.id]);

  // Track current page (skip excluded + detail/sub pages)
  useEffect(() => {
    if (EXCLUDE.some(p => currentPath.startsWith(p))) return;
    // Only track root-level pages (no dynamic segments)
    if (currentPath.split("/").filter(Boolean).length > 1) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      const filtered = stored.filter(p => p !== currentPath);
      const updated = [currentPath, ...filtered].slice(0, MAX_ITEMS);
      sessionStorage.setItem(storageKey, JSON.stringify(updated));
      setRecent(updated);
    } catch {}
  }, [currentPath, storageKey]);

  if (recent.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1 flex items-center gap-1.5">
        <Clock className="w-3 h-3" /> Recent
      </h3>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {recent.map(path => (
          <button
            key={path}
            onClick={() => onNavigate(path)}
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
        ))}
      </div>
    </div>
  );
}