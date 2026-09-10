import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "nali_recent_pages";
const MAX_ITEMS = 4;
// Paths that shouldn't be tracked (transient/auth pages)
const EXCLUDE = ["/login", "/register", "/forgot-password", "/reset-password", "/onboarding"];

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
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
      setRecent(stored);
    } catch { setRecent([]); }
  }, [currentPath]);

  // Track current page (skip excluded + detail/sub pages)
  useEffect(() => {
    if (EXCLUDE.some(p => currentPath.startsWith(p))) return;
    // Only track root-level pages (no dynamic segments)
    if (currentPath.split("/").filter(Boolean).length > 1) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
      const filtered = stored.filter(p => p !== currentPath);
      const updated = [currentPath, ...filtered].slice(0, MAX_ITEMS);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setRecent(updated);
    } catch {}
  }, [currentPath]);

  if (recent.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1 flex items-center gap-1.5">
        <Clock className="w-3 h-3" /> Recent
      </h3>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {recent.map(path => (
          <button
            key={path}
            onClick={() => onNavigate(path)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
              path === currentPath
                ? "bg-primary/15 text-primary border border-primary/20"
                : "bg-secondary/60 text-foreground hover:bg-secondary"
            )}
          >
            <span className="text-sm">{ICONS[path] || "📄"}</span>
            <span className="capitalize">{path === "/" ? "Home" : path.split("/")[1].replace(/-/g, " ")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}