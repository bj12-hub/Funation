"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveCumulative, setCumulativeVisible } from "@/services/crew/crewCumulative";
import {
  CUMULATIVE_ROWS,
  CUMULATIVE_SORTS,
  CUMULATIVE_TITLE_DEFAULT,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  WINDOW_GAUGE_BASES,
  cumulativeText,
  type BroadcastResult,
  type CumulativeLive,
  type CumulativeSettings,
  type CumulativeSort
} from "@/services/crew/crewTypes";
import { AMOUNT_BASIS_KEY, BoardAddress, PLACEMENT_KEY, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import prize from "./prize.module.css";

const SORT_KEY: Record<CumulativeSort, MessageKey> = { TOTAL: "crewOpsBoards.sortTotal", ORDER: "crewOpsBoards.sortOrder" };

/**
 * 누적 기여도 — code-first (no Figma frame; StreamDonate 누적 기여도 참고, 2026-10-25), inside `/creator/crew/broadcast`. Each
 * member's final scores (or, on 후원금, what they received) of the live broadcast's project (프리셋 = 프로젝트) plus this 회차,
 * for OBS `?cumulative`. Settings
 * are saved with 설정 저장 (also before going live); OBS에 표시 works while live.
 */
export function CumulativePanel({
  settings,
  live,
  overlayPath,
  pending,
  run
}: {
  settings: CumulativeSettings;
  live: { broadcastId: string; board: CumulativeLive } | null;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);
  const board = live?.board;
  return (
    <section className={styles.card} aria-labelledby="bc-cumulative">
      <div className={styles.cardHead}>
        <h2 id="bc-cumulative" className={styles.cardTitle}>
          {t("crewOpsBoards.cumTitle")}
        </h2>
        {live && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!board?.visible}
              disabled={pending}
              onChange={(e) =>
                run(() => setCumulativeVisible({ broadcastId: live.broadcastId, on: e.target.checked }), e.target.checked ? t("crewOpsBoards.boardShown", { label: t("crewOpsBoards.cumTitle") }) : t("crewOpsBoards.boardHidden", { label: t("crewOpsBoards.cumTitle") }))
              }
            />
            {t("crewOps.showOnObs")}
          </label>
        )}
      </div>
      <p className={styles.note}>{t("crewOpsBoards.cumNote")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCumulative(draft), t("crewOpsBoards.cumSaved"));
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.titleLabel")}</span>
          <input className={styles.input} aria-label={t("crewOpsBoards.cumTitleAria")} placeholder={CUMULATIVE_TITLE_DEFAULT} maxLength={PRIZE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.basisLabel")}</span>
          <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.cumBasisAria")}>
            {[...WINDOW_GAUGE_BASES].reverse().map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {t(AMOUNT_BASIS_KEY[b.key])}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.cumDisplayAria")}>
          <span className={styles.muted}>{t("crewOpsBoards.display")}</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.rowsAria")}>
              {CUMULATIVE_ROWS.map((n) => (
                <button key={n} type="button" aria-pressed={draft.rows === n} onClick={() => edit({ rows: n })}>
                  {draft.sort === "ORDER" ? t("crewOpsBoards.rowsN", { n }) : t("crewOpsBoards.rowsTopN", { n })}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.cumSortAria")}>
              {CUMULATIVE_SORTS.map((x) => (
                <button key={x.key} type="button" aria-pressed={draft.sort === x.key} onClick={() => edit({ sort: x.key })}>
                  {t(SORT_KEY[x.key])}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showBreakdown} onChange={(e) => edit({ showBreakdown: e.target.checked })} />
              {t("crewOpsBoards.showBreakdown")}
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showRounds} onChange={(e) => edit({ showRounds: e.target.checked })} />
              {t("crewOpsBoards.showRounds")}
            </label>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.cumPlacementAria")}>
              {PRIZE_PLACEMENTS.map((p) => (
                <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
                  {t(PLACEMENT_KEY[p.key])}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            {t("crewOps.revert")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            {t("crewOps.saveSettings")}
          </button>
        </div>
      </form>

      {!board ? (
        <p className={styles.note}>{t("crewOpsBoards.liveIdle")}</p>
      ) : (
        <>
          <p className={styles.muted}>{board.project ? t("crewOpsBoards.cumProject", { project: board.project, rounds: board.rounds }) : t("crewOpsBoards.cumNoProject")}</p>
          {dirty && <p className={styles.note}>{t("crewOpsBoards.unsavedObs")}</p>}
          {board.rows.length ? (
            <ol className={prize.preview} aria-label={t("crewOpsBoards.cumPreviewAria")}>
              {board.rows.map((r) => (
                <li key={r.memberId}>
                  <span className={styles.rankNo}>{r.rank}</span>
                  <span className={styles.boardName}>
                    <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                    {r.name}
                  </span>
                  <span className={prize.previewPrize}>
                    {t("crewOpsBoards.cumPastCurrent", { past: cumulativeText(r.past, board.unit), current: cumulativeText(r.current, board.unit) })}
                  </span>
                  <strong>{cumulativeText(r.total, board.unit)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>{t("crewOpsBoards.noRankable")}</p>
          )}
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?cumulative" label={t("crewOpsBoards.cumTitle")} />
    </section>
  );
}
