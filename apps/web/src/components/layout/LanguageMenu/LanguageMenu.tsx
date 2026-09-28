"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LanguageMenu.module.css";

/**
 * Header language selector.
 * Figma: lang-dropdown-menu 265:242 (colors adapted to the service tokens).
 * TODO: wire to i18n once translations exist; for now only the selection is shown.
 */
const LANGUAGES = [
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "en", flag: "🇺🇸", label: "ENGLISH" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "th", flag: "🇹🇭", label: "ภาษาไทย" }
] as const;

export function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<(typeof LANGUAGES)[number]>(LANGUAGES[0]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`언어 선택: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.flag} aria-hidden="true">
          {current.flag}
        </span>
        <span className={styles.label}>{current.label}</span>
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label="언어">
          {LANGUAGES.map((lang) => {
            const selected = lang.code === current.code;
            return (
              <li key={lang.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ""}`}
                  onClick={() => {
                    setCurrent(lang);
                    setOpen(false);
                  }}
                >
                  <span className={styles.flag} aria-hidden="true">
                    {lang.flag}
                  </span>
                  {lang.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
