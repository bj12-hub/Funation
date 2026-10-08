/**
 * Theme preference (code-first; light theme has no Figma frames yet). Stored per browser in
 * localStorage — a viewer convenience, not account data (syncing with the account is TBD).
 * `system` follows the OS setting. Default is dark (the Figma design).
 */
export type ThemePreference = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "ssumnation-theme";

export function resolveTheme(pref: string | null, prefersLight: boolean): Theme {
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "system") return prefersLight ? "light" : "dark";
  return "dark";
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme. Kept tiny and
 * self-contained (it cannot import modules); mirrors `resolveTheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){var d="dark";try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p==="light"||p==="dark")d=p;else if(p==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches)d="light";}catch(e){}document.documentElement.setAttribute("data-theme",d);})();`;

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function applyThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Private mode / blocked storage: the choice still applies to this page view.
  }
  document.documentElement.setAttribute("data-theme", resolveTheme(pref, window.matchMedia("(prefers-color-scheme: light)").matches));
}
