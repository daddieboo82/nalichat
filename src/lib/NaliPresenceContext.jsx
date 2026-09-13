import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const NaliPresenceContext = createContext(null);

const LEGACY_STORAGE_KEY = "nali_presence_level";
const storageKeyFor = (userId) => `nali_presence_level:${userId || "anonymous"}`;
// level: 'proactive' (subtle auto hints) | 'minimal' (on-demand only) | 'off' (hidden)
const DEFAULT_LEVEL = "proactive";
const VALID_LEVELS = ["proactive", "minimal", "off"];

export function NaliPresenceProvider({ children }) {
  const { user } = useAuth();
  const savingRef = useRef(false);
  const identityGenerationRef = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const storageKey = storageKeyFor(user?.id);
  const [level, setLevelState] = useState(DEFAULT_LEVEL);

  useEffect(() => {
    identityGenerationRef.current += 1;
    savingRef.current = false;
    setIsSaving(false);

    // Server profile wins for signed-in users. Otherwise use only this account's
    // device-local preference; never inherit another account's setting.
    if (user?.nali_presence_level && VALID_LEVELS.includes(user.nali_presence_level)) {
      setLevelState(user.nali_presence_level);
      try { localStorage.setItem(storageKey, user.nali_presence_level); } catch {}
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && VALID_LEVELS.includes(saved)) {
        setLevelState(saved);
        return;
      }

      // One-time compatibility for anonymous users only. Never migrate the old
      // global value into a signed-in account because it may belong to someone else.
      if (!user?.id) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy && VALID_LEVELS.includes(legacy)) {
          setLevelState(legacy);
          localStorage.setItem(storageKey, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return;
        }
      }
    } catch {}

    setLevelState(DEFAULT_LEVEL);
  }, [storageKey, user?.id, user?.nali_presence_level]);

  const setLevel = useCallback(async (newLevel) => {
    if (!VALID_LEVELS.includes(newLevel) || savingRef.current) return;
    const previousLevel = level;
    const generation = identityGenerationRef.current;

    setLevelState(newLevel);
    try { localStorage.setItem(storageKey, newLevel); } catch {}

    // Anonymous users keep this preference locally. Signed-in users also persist
    // it to the profile so it follows them across devices.
    if (!user?.id) return;

    savingRef.current = true;
    setIsSaving(true);
    try {
      const response = await base44.functions.invoke("updateMyProfile", {
        nali_presence_level: newLevel,
      });
      if (generation !== identityGenerationRef.current) return;
      if (response?.data?.error) throw new Error(response.data.error);
      if (response?.data?.success !== true) {
        throw new Error("Nali Presence update was not confirmed.");
      }
    } catch (error) {
      if (generation !== identityGenerationRef.current) return;
      setLevelState(previousLevel);
      try { localStorage.setItem(storageKey, previousLevel); } catch {}
      console.error("Nali presence update failed:", error);
      toast.error(error?.message || "Could not save your Nali Presence setting.");
    } finally {
      if (generation === identityGenerationRef.current) {
        savingRef.current = false;
        setIsSaving(false);
      }
    }
  }, [level, storageKey, user?.id]);

  const value = useMemo(() => ({
    level,
    setLevel,
    isSaving,
    isMuted: level === "off",
    isProactive: level === "proactive",
    isMinimal: level === "minimal",
  }), [level, setLevel, isSaving]);

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