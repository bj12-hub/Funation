"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveDonorMerges } from "@/services/crew/crewFeed";
import { DONOR_ALIASES_MAX, DONOR_MERGES_MAX, DONOR_NAME_MAX, type BroadcastResult, type DonorMerge, type DonorSummaryRow } from "@/services/crew/crewTypes";
import { useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import feed from "./feed.module.css";

type Row = { id: string | null; name: string; aliases: string };
const toRows = (merges: DonorMerge[]): Row[] => merges.map((g) => ({ id: g.id, name: g.name, aliases: g.aliases.join(", ") }));

/**
 * 후원자별 정리 · 후원자 이름 병합 — code-first (no Figma frame; StreamDonate 후원 및 통합 관리 참고, 2026-10-25), inside the
 * 후원 리스트. Donors of this broadcast under their merged name, and the merge groups (대표 이름 + names to merge, comma
 * separated), saved with 저장. Studio only: names on stream stay as sent.
 */
export function DonorPanel({ donors, merges, pending, run }: { donors: DonorSummaryRow[]; merges: DonorMerge[]; pending: boolean; run: (action: () => Promise<BroadcastResult>, ok?: string) => void }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty } = useSettingsDraft(toRows(merges));
  const setRow = (i: number, patch: Partial<Row>) => setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () =>
    run(
      () => saveDonorMerges({ merges: draft.filter((r) => r.name.trim() || r.aliases.trim()).map((r) => ({ id: r.id, name: r.name, aliases: r.aliases.split(/[,\n]/) })) }),
      t("crewOpsFeed.mergesSaved")
    );

  return (
    <details className={feed.panel}>
      <summary>
        {t("crewOpsFeed.donorsTitle")} {merges.length > 0 && <span className={styles.muted}>{t("crewOpsFeed.mergeCount", { count: merges.length })}</span>}
      </summary>
      <div className={feed.donors}>
        {donors.length === 0 ? (
          <p className={styles.note}>{t("crewOpsFeed.donorsEmpty")}</p>
        ) : (
          <div className={feed.tableWrap}>
            <table className={feed.table}>
              <caption>{t("crewOpsFeed.donorsCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("crewOpsFeed.colDonor")}</th>
                  <th scope="col">{t("crewOpsFeed.colNames")}</th>
                  <th scope="col">{t("crewOpsFeed.colCount")}</th>
                  <th scope="col">{t("crewOpsFeed.modePoints")}</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((d) => (
                  <tr key={d.name}>
                    <th scope="row">{d.name}</th>
                    <td className={feed.names}>{d.names.join(", ")}</td>
                    <td>{t("crewOpsFeed.count", { n: formatNumber(d.count) })}</td>
                    <td>{t("crewOpsFeed.points", { n: formatNumber(d.points) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <strong>{t("crewOpsFeed.mergeTitle")}</strong>
        <p className={styles.note}>{t("crewOpsFeed.mergeNote")}</p>
        {draft.length === 0 ? (
          <p className={styles.note}>{t("crewOpsFeed.mergesEmpty")}</p>
        ) : (
          <ul className={feed.merges}>
            {draft.map((r, i) => (
              <li key={r.id ?? `new-${i}`}>
                <input className={styles.input} aria-label={t("crewOpsFeed.mainNameAria", { n: i + 1 })} placeholder={t("crewOpsFeed.mainNamePlaceholder")} maxLength={DONOR_NAME_MAX} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                <input
                  className={styles.input}
                  aria-label={t("crewOpsFeed.aliasesAria", { n: i + 1 })}
                  placeholder={t("crewOpsFeed.aliasesPlaceholder", { max: DONOR_ALIASES_MAX })}
                  value={r.aliases}
                  onChange={(e) => setRow(i, { aliases: e.target.value })}
                />
                <button type="button" className={styles.ghost} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  {t("crewOps.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={draft.length >= DONOR_MERGES_MAX} onClick={() => setDraft([...draft, { id: null, name: "", aliases: "" }])}>
            {t("crewOpsFeed.addMerge")}
          </button>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toRows(merges))}>
            {t("crewOps.revert")}
          </button>
          <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={save}>
            {t("crewOps.save")}
          </button>
        </div>
      </div>
    </details>
  );
}
