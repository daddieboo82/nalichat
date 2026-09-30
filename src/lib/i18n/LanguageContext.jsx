// Language context: auto-detects from browser on first visit, persists choice
// to localStorage, optionally syncs to user profile, and drives the DOM
// translation engine for non-English languages.

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { translationEngine } from "./translationEngine";

const STORAGE_KEY = "nali_language";
const DEFAULT_LANG = "en";
const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "yi"]);

function detectBrowserLanguage() {
  try {
    return (navigator.language || "en").split("-")[0].toLowerCase() || DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function getStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

const LanguageContext = createContext({
  language: DEFAULT_LANG,
  setLanguage: () => {},
  translating: false,
});

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState(() => getStoredLanguage() || detectBrowserLanguage());
  const [translating, setTranslating] = useState(false);

  // Use saved profile language if no local preference has been set yet.
  useEffect(() => {
    if (!user || getStoredLanguage()) return;
    if (user.language && user.language !== language) {
      setLanguageState(user.language);
    }
  }, [user]);

  // Start or stop the translation engine based on the active language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGS.has(language) ? "rtl" : "ltr";
    if (language === "en") return undefined;

    const engine = translationEngine(language, setTranslating);
    engine.start();
    return () => engine.stop();
  }, [language]);

  const setLanguage = useCallback(
    (lang) => {
      if (!lang || lang === language) return;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {}
      try {
        base44.auth.updateMe({ language: lang }).catch(() => {});
      } catch {}
      // Reload so the new language applies cleanly without stale translated DOM.
      window.location.reload();
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translating }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}