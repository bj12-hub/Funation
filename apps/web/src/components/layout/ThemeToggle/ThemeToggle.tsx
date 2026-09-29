"use client";

import { useEffect, useState } from "react";
import { applyThemePreference, readThemePreference, resolveTheme, type Theme } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

/**
 * Header light/dark switch — code-first (no Figma frame). The initial theme is set before paint by
 * THEME_INIT_SCRIPT; this button only renders its icon after mount so server and client markup match.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveTheme(readThemePreference(), window.matchMedia("(prefers-color-scheme: light)").matches));
  }, []);

  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={theme ? `${next === "light" ? "라이트" : "다크"} 모드로 전환` : "테마 전환"}
      title={theme ? `${next === "light" ? "라이트" : "다크"} 모드` : undefined}
      onClick={() => {
        applyThemePreference(next);
        setTheme(next);
      }}
    >
      <span aria-hidden="true">{theme === null ? "" : theme === "light" ? "🌙" : "☀️"}</span>
    </button>
  );
}
