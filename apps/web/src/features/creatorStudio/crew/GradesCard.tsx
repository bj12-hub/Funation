"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveCrewGrades } from "@/services/crew/crew";
import { GRADES_MAX, GRADE_MULTIPLIER_MAX, GRADE_NAME_MAX, type CrewGrade, type CrewSaveResult } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";

type Draft = { id?: string; name: string; multiplier: string };

/**
 * 직급 · 직급 배수 — code-first (엑셀방송 직급전, 2026-10-06 결정). The creator names the grades and sets each 배수
 * (default 1배 = no effect, like 배틀). Members pick a grade in the list above; on the 방송 운영 scoreboard what a
 * member receives counts × their 배수, shown as its own "직급 배수" part.
 */
export function GradesCard({ grades, pending, run }: { grades: CrewGrade[]; pending: boolean; run: (action: () => Promise<CrewSaveResult>, ok: string, after?: () => void) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const list = draft ?? grades.map((g) => ({ id: g.id, name: g.name, multiplier: String(g.multiplier) }));
  const edit = (i: number, patch: Partial<Draft>) => setDraft(list.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const save = () =>
    run(
      () => saveCrewGrades({ grades: list.map((g) => ({ id: g.id, name: g.name, multiplier: Number(g.multiplier) })) }),
      t("crewOps.gradesSaved"),
      () => setDraft(null)
    );

  return (
    <section className={styles.card} aria-labelledby="crew-grades">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="crew-grades">
          {t("crewOps.gradesTitle")}
        </h2>
        <span className={styles.muted}>
          {list.length} / {GRADES_MAX}
        </span>
      </div>
      <p className={styles.note}>{t("crewOps.gradesNote")}</p>
      {list.length === 0 ? (
        <p className={styles.empty}>{t("crewOps.gradesEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {list.map((g, i) => (
            <li key={g.id ?? `new-${i}`} className={styles.row}>
              <div className={styles.rowMain}>
                <input className={styles.input} aria-label={t("crewOps.gradeNameAria", { n: i + 1 })} placeholder={t("crewOps.gradeNamePlaceholder")} maxLength={GRADE_NAME_MAX} value={g.name} onChange={(e) => edit(i, { name: e.target.value })} />
              </div>
              <label className={styles.muted}>
                {t("crewOps.multiplierLabel")}{" "}
                <input
                  className={styles.input}
                  style={{ width: 80 }}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={GRADE_MULTIPLIER_MAX}
                  step={0.01}
                  aria-label={t("crewOps.gradeMultiplierAria", { n: i + 1 })}
                  value={g.multiplier}
                  onChange={(e) => edit(i, { multiplier: e.target.value })}
                />{" "}
                {t("crewOps.multiplierSuffix")}
              </label>
              <div className={styles.rowActions}>
                <button type="button" className={styles.danger} disabled={pending} onClick={() => setDraft(list.filter((_, j) => j !== i))}>
                  {t("crewOps.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} disabled={pending || list.length >= GRADES_MAX} onClick={() => setDraft([...list, { name: "", multiplier: "1" }])}>
          {t("crewOps.addGrade")}
        </button>
        {draft && (
          <>
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => setDraft(null)}>
              {t("crewOps.cancel")}
            </button>
            <button type="button" className={styles.primary} disabled={pending} onClick={save}>
              {pending ? t("crewOps.saving") : t("crewOps.save")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
