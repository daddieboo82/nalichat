import { useEffect } from "react";

/**
 * Detects and follows the operating system's dark-mode preference,
 * applying / removing the `dark` class on <html>. Updates live when the
 * user changes their system theme (e.g. Android auto night mode).
 */
export function useSystemTheme() {
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (isDark) => {
      const root = document.documentElement;
      if (isDark) root.classList.add("dark");
      else root.classList.remove("dark");
    };

    apply(mql.matches);

    const onChange = (e) => apply(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
}