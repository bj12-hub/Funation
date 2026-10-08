"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./LanguageMenu.module.css";

/**
 * Header language selector. Figma: lang-dropdown-menu 265:242 (colors adapted to the service tokens).
 * 한국어 · ENGLISH switch the locale cookie and re-render on the server; the other languages are listed
 * as 준비 중 until translations exist (TBD).
 */
export function LanguageMenu() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGE_OPTIONS.find((l) => l.code === locale) ?? LANGUAGE_OPTIONS[0];

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

  const choose = (code: string) => {
    setOpen(false);
    if (code === locale) return;
    startTransition(async () => {
      const res = await setLocale(code);
      if (res.status === "SAVED") router.refresh();
    });
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={pending}
        aria-label={t("common.languageSelect", { label: current.label })}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.flag} aria-hidden="true">
          {current.flag}
        </span>
        <span className={styles.label}>{current.label}</span>
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label={t("common.languages")}>
          {LANGUAGE_OPTIONS.map((lang) => {
            const selected = lang.code === locale;
            return (
              <li key={lang.code} role="option" aria-selected={selected} aria-disabled={!lang.ready}>
                <button
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ""} ${lang.ready ? "" : styles.itemDisabled}`}
                  disabled={!lang.ready}
                  title={lang.ready ? undefined : t("common.languageSoon")}
                  onClick={() => choose(lang.code)}
                >
                  <span className={styles.flag} aria-hidden="true">
                    {lang.flag}
                  </span>
                  {lang.label}
                  {!lang.ready && <span className={styles.soon}>{t("common.languageSoon")}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
