"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveWindowGauge } from "@/services/crew/crewGauge";
import {
  GAUGE_NUMBERS,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  WINDOW_GAUGE_BASES,
  WINDOW_GAUGE_TITLE_DEFAULT,
  type BroadcastResult,
  type WindowGaugeLive,
  type WindowGaugeSettings
} from "@/services/crew/crewTypes";
import { AMOUNT_BASIS_KEY, BoardAddress, BoardVisibleToggle, NUMBERS_KEY, PLACEMENT_KEY, PrizeWindowBar, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import gauge from "./gauge.module.css";
import prize from "./prize.module.css";

const digits = (s: string) => s.replace(/[^\d]/g, "").slice(0, 10);

/**
 * 시간 내 통합 게이지 — code-first (no Figma frame; StreamDonate 시간 내 통합 게이지 참고, 2026-10-25), inside
 * `/creator/crew/broadcast`. One goal gauge for the whole crew counting only between 시작 and 정지, on 후원금 (every
 * donation of the 구간, in the 자동엑셀 unit) or 기여도 (the members' 구간 points). 설정 저장 also before going live; OBS에
 * 표시 (`?windowgauge`) and the 구간 while live — the 순위표 controls with `board: "WINDOW_GAUGE"`.
 */
export function WindowGaugePanel({
  settings,
  live,
  overlayPath,
  pending,
  run
}: {
  settings: WindowGaugeSettings;
  live: { broadcastId: string; board: WindowGaugeLive } | null;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  // Amounts are typed as text and sent as numbers.
  const toDraft = (s: WindowGaugeSettings) => ({ ...s, goal: String(s.goal), autoRaise: s.autoRaise ? String(s.autoRaise) : "" });
  const { draft, setDraft, edit, dirty } = useSettingsDraft(toDraft(settings));
  const board = live?.board;
  return (
    <section className={styles.card} aria-labelledby="bc-windowgauge">
      <div className={styles.cardHead}>
        <h2 id="bc-windowgauge" className={styles.cardTitle}>
          {t("crewOpsBoards.windowGaugeTitle")}
        </h2>
        {live && <BoardVisibleToggle broadcastId={live.broadcastId} board="WINDOW_GAUGE" visible={!!board?.visible} label={t("crewOpsBoards.windowGaugeLabel")} pending={pending} run={run} />}
      </div>
      <p className={styles.note}>{t("crewOpsBoards.windowGaugeNote")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveWindowGauge({ ...draft, goal: Number(draft.goal) || 0, autoRaise: Number(draft.autoRaise) || 0 }), t("crewOpsBoards.windowGaugeSaved"));
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.titleLabel")}</span>
          <input className={styles.input} aria-label={t("crewOpsBoards.windowGaugeTitleAria")} placeholder={WINDOW_GAUGE_TITLE_DEFAULT} maxLength={PRIZE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.windowGaugeBasisAria")}>
          <span className={styles.muted}>{t("crewOpsBoards.basisLabel")}</span>
          <span className={styles.segment}>
            {WINDOW_GAUGE_BASES.map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {t(AMOUNT_BASIS_KEY[b.key])}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.goalRaiseLabel")}</span>
          <span className={prize.inline}>
            <input className={styles.input} inputMode="numeric" aria-label={t("crewOpsBoards.windowGoalAria")} placeholder={t("crewOpsBoards.goal")} value={draft.goal} onChange={(e) => edit({ goal: digits(e.target.value) })} />
            <input className={styles.input} inputMode="numeric" aria-label={t("crewOpsBoards.autoRaise")} placeholder={t("crewOpsBoards.autoRaisePlaceholder")} value={draft.autoRaise} onChange={(e) => edit({ autoRaise: digits(e.target.value) })} />
          </span>
          <span className={styles.note}>{t("crewOpsBoards.goalRaiseNote")}</span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.windowGaugeDisplayAria")}>
          <span className={styles.muted}>{t("crewOpsBoards.display")}</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.windowNumbersAria")}>
              {GAUGE_NUMBERS.map((n) => (
                <button key={n.key} type="button" aria-pressed={draft.numbers === n.key} onClick={() => edit({ numbers: n.key })}>
                  {t(NUMBERS_KEY[n.key])}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.windowPlacementAria")}>
              {PRIZE_PLACEMENTS.map((p) => (
                <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
                  {t(PLACEMENT_KEY[p.key])}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(settings))}>
            {t("crewOps.revert")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty || !Number(draft.goal)}>
            {t("crewOps.saveSettings")}
          </button>
        </div>
      </form>

      {!live || !board ? (
        <p className={styles.note}>{t("crewOpsBoards.windowGaugeIdle")}</p>
      ) : (
        <>
          <PrizeWindowBar broadcastId={live.broadcastId} board="WINDOW_GAUGE" span={board.window} pending={pending} run={run} />
          {dirty && <p className={styles.note}>{t("crewOpsBoards.unsavedPreview")}</p>}
          <div className={gauge.preview} aria-label={t("crewOpsBoards.windowPreviewAria")}>
            <span className={gauge.track} aria-hidden="true">
              <span className={gauge.fill} style={{ width: `${board.percent}%`, background: "var(--color-primary)" }} />
            </span>
            <span className={styles.muted}>
              {t("crewOpsBoards.windowProgress", { current: formatNumber(board.current), target: formatNumber(board.target), unit: board.unit, percent: board.percent, count: formatNumber(board.count) })}
              {board.target > board.settings.goal && t("crewOpsBoards.autoRaised")}
            </span>
          </div>
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?windowgauge" label={t("crewOpsBoards.windowGaugeLabel")} />
    </section>
  );
}
