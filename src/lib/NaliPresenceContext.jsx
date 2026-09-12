import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const NaliPresenceContext = createContext(null);

const STORAGE_KEY = "nali_presence_level";
// level: 'proactive' (subtle auto hints) | 'minimal' (on-demand only) | 'off' (hidden)
const DEFAULT_LEVEL = "proactive";
const VALID_LEVELS = ["proactive", "minimal", "off"];

export function NaliPresenceProvider({ children }) {
  const { user } = useAuth();
  const [level, setLevelState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_LEVEL; } catch { return DEFAULT_LEVEL; }
  });

  useEffect(() => {
    // User-saved level takes precedence over localStorage when auth resolves.
    if (user?.nali_presence_level && VALID_LEVELS.includes(user.nali_presence_level)) {
      setLevelState(user.nali_presence_level);
      try { localStorage.setItem(STORAGE_KEY, user.nali_presence_level); } catch {}
    }
  }, [user?.nali_presence_level]);

  const setLevel = useCallback(async (newLevel) => {
    if (!VALID_LEVELS.includes(newLevel)) return;
    const previousLevel = level;

    setLevelState(newLevel);
    try { localStorage.setItem(STORAGE_KEY, newLevel); } catch {}

    // Anonymous users keep this preference locally. Signed-in users also persist
    // it to the profile so it follows them across devices.
    if (!user?.id) return;

    try {
      const response = await base44.functions.invoke("updateMyProfile", {
        nali_presence_level: newLevel,
      });
      if (response?.data?.error) throw new Error(response.data.error);
    } catch (error) {
      setLevelState(previousLevel);
      try { localStorage.setItem(STORAGE_KEY, previousLevel); } catch {}
      console.error("Nali presence update failed:", error);
      toast.error(error?.message || "Could not save your Nali Presence setting.");
    }
  }, [level, user?.id]);

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