import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, resolveTheme } from "./theme";

describe("theme", () => {
  it("resolves saved preferences, following the OS only for 'system', and defaults to dark", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("garbage", true)).toBe("dark");
  });

  it("init script reads the same storage key and falls back to dark", () => {
    expect(THEME_INIT_SCRIPT).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
    expect(THEME_INIT_SCRIPT).toContain('var d="dark"');
  });
});
