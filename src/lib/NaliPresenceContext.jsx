import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";

const NaliPresenceContext = createContext(null);

const STORAGE_KEY = "nali_presence_level";
// level: 'proactive' (subtle auto hints) | 'minimal' (on-demand only) | 'off' (hidden)
const DEFAULT_LEVEL = "proactive";
const VALID_LEVELS = ["proactive", "minimal", "off"];

export function NaliPresenceProvider({ children }) {
  const [level, setLevelState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_LEVEL; } catch { return DEFAULT_LEVEL; }
  });

  useEffect(() => {
    // User-saved level takes precedence over localStorage on load.
    base44.auth.me().then(u => {
      if (u?.nali_presence_level && VALID_LEVELS.includes(u.nali_presence_level)) {
        setLevelState(u.nali_presence_level);
        try { localStorage.setItem(STORAGE_KEY, u.nali_presence_level); } catch {}
      }
    }).catch(() => {});
  }, []);

  const setLevel = useCallback((newLevel) => {
    if (!VALID_LEVELS.includes(newLevel)) return;
    setLevelState(newLevel);
    try { localStorage.setItem(STORAGE_KEY, newLevel); } catch {}
    base44.auth.updateMe({ nali_presence_level: newLevel }).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    level,
    setLevel,
    isMuted: level === "off",
    isProactive: level === "proactive",
    isMinimal: level === "minimal",
  }), [level, setLevel]);

  return (
    <NaliPresenceContext.Provider value={value}>
      {children}
    </NaliPresenceContext.Provider>
  );
}

export function useNaliPresence() {
  const ctx = useContext(NaliPresenceContext);
  if (!ctx) return { level: "proactive", setLevel: () => {}, isMuted: false, isProactive: true, isMinimal: false };
  return ctx;
}