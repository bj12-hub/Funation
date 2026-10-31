"use client";

import { useCallback, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { addFilterWord, removeFilterWord, setFilterStrength, setSpamBlock } from "@/services/creator/donationManagement";
import { FILTER_STRENGTHS, FILTER_WORD_MAX, type FilterSettings, type FilterStrength, type ManagementSaveResult } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

const STRENGTH_KEY: Record<FilterStrength, MessageKey> = { HIGH: "studioDonations.strengthHigh", NORMAL: "studioDonations.strengthNormal", OFF: "studioDonations.strengthOff" };

/** 필터링 — Figma 539:466. Choices save as they change (the design has no save button). */
export function FilterSettingsPanel({ initial }: { initial: FilterSettings }) {
  const { t } = useI18n();
  const messageOf = (r: ManagementSaveResult) => (r.status === "INVALID" ? r.message : r.status === "UNAUTHORIZED" ? t("studioDonations.loginRequired") : null);
  const FAILED: ManagementSaveResult = { status: "INVALID", message: t("studioDonations.saveFailedRetry") };
  const [strength, setStrength] = useState(initial.strength);
  const [spam, setSpam] = useState(initial.blockSpam);
  const [words, setWords] = useState(initial.words);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const notify = (r: ManagementSaveResult, ok = t("studioDonations.saved")) => setToast(messageOf(r) ?? ok);

  const changeStrength = async (next: FilterStrength) => {
    const prev = strength;
    setStrength(next);
    const r = await setFilterStrength(next).catch(() => FAILED);
    if (r.status !== "SAVED") setStrength(prev);
    notify(r);
  };

  const add = async () => {
    const w = word.trim();
    if (!w || busy) return;
    setBusy(true);
    try {
      const r = await addFilterWord(w).catch(() => FAILED);
      notify(r, t("studioDonations.wordAdded"));
      if (r.status === "SAVED") {
        setWords((list) => [...list, w]);
        setWord("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={styles.card} aria-labelledby="filter-title">
        <h2 id="filter-title" className={styles.cardTitle}>
          {t("studioDonations.autoBlockTitle")}
        </h2>
        <p className={styles.desc}>{t("studioDonations.autoBlockDesc")}</p>
        {/* Code-first copy (2026-10-06 결정 "대체 메시지로 바꿔 표시"). */}
        <p className={styles.helper}>{t("studioDonations.autoBlockHelp")}</p>
        <div className={`${styles.line} ${styles.lineWide}`}>
          <span className={styles.lineLabel}>{t("studioDonations.strength")}</span>
          <div role="radiogroup" aria-label={t("studioDonations.strength")} className={styles.radios}>
            {FILTER_STRENGTHS.map((s) => (
              <label key={s.key} className={`${styles.radio} ${strength === s.key ? styles.radioOn : ""}`}>
                <input type="radio" name="filter-strength" checked={strength === s.key} onChange={() => changeStrength(s.key)} />
                {t(STRENGTH_KEY[s.key])}
              </label>
            ))}
          </div>
        </div>
        <div className={`${styles.line} ${styles.lineWide}`}>
          <span className={styles.lineLabel}>{t("studioDonations.spam")}</span>
          <div className={styles.lineControl}>
            <Toggle
              label={t("studioDonations.spam")}
              checked={spam}
              onChange={async (v) => {
                setSpam(v);
                const r = await setSpamBlock(v).catch(() => FAILED);
                if (r.status !== "SAVED") setSpam(!v);
                notify(r);
              }}
            />
          </div>
        </div>
        <div className={`${styles.line} ${styles.lineWide}`}>
          <span className={styles.lineLabel}>{t("studioDonations.blacklist")}</span>
          <div className={styles.inline}>
            <input
              aria-label={t("studioDonations.filterWord")}
              className={styles.input}
              maxLength={FILTER_WORD_MAX}
              placeholder={t("studioDonations.filterWordPlaceholder")}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <button type="button" className={styles.solidPurple} onClick={add} disabled={busy || !word.trim()}>
              {t("studioDonations.register")}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="filter-words">
        <h2 id="filter-words" className={styles.cardTitleSmall}>
          {t("studioDonations.activeWords", { count: words.length })}
        </h2>
        {words.length === 0 ? (
          <p className={styles.helper}>{t("studioDonations.noWords")}</p>
        ) : (
          <ul className={styles.chips}>
            {words.map((w) => (
              <li key={w}>
                {w}
                <button
                  type="button"
                  aria-label={t("studioDonations.removeWord", { word: w })}
                  onClick={async () => {
                    const r = await removeFilterWord(w).catch(() => FAILED);
                    if (r.status === "SAVED") setWords((list) => list.filter((x) => x !== w));
                    notify(r, t("studioDonations.wordRemoved"));
                  }}
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
