"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveGauge, savePledges, setGaugeVisible } from "@/services/crew/crewGauge";
import {
  GAUGE_NUMBERS,
  GAUGE_TITLE_DEFAULT,
  PLEDGE_TEXT_MAX,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  type BroadcastResult,
  type CrewMember,
  type GaugeLive,
  type GaugeSettings,
  type MemberPledge
} from "@/services/crew/crewTypes";
import { BoardAddress, NUMBERS_KEY, PLACEMENT_KEY, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import gauge from "./gauge.module.css";
import prize from "./prize.module.css";

type Run = (action: () => Promise<BroadcastResult>, ok?: string) => void;
type PledgeRow = { id: string; text: string; goal: string };

/**
 * BJ 공약 · 출근 BJ 게이지 — code-first (no Figma frame; StreamDonate BJ 게이지 · BJ 공약 · 출근 참고, 2026-10-25), inside
 * `/creator/crew/broadcast`. Each member's 공약 and 목표 점수 (공약 저장; public on the 후원 페이지 and the 크루 tab), the
 * 게이지 settings (설정 저장) and, while live, OBS에 표시 and the gauge as OBS draws it (`?bjgauge`).
 */
export function GaugePanel({
  members,
  pledges,
  settings,
  live,
  overlayPath,
  pending,
  run
}: {
  members: CrewMember[];
  pledges: Record<string, MemberPledge>;
  settings: GaugeSettings;
  live: { broadcastId: string; board: GaugeLive } | null;
  overlayPath: string;
  pending: boolean;
  run: Run;
}) {
  const { t } = useI18n();
  const rowsOf = (): PledgeRow[] => members.map((m) => ({ id: m.id, text: pledges[m.id]?.text ?? "", goal: pledges[m.id]?.goal ? String(pledges[m.id].goal) : "" }));
  const pledgeDraft = useSettingsDraft(rowsOf());
  const setRow = (id: string, patch: Partial<PledgeRow>) => pledgeDraft.setDraft(pledgeDraft.draft.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const savePledgeRows = () =>
    run(
      () => savePledges({ pledges: Object.fromEntries(pledgeDraft.draft.map((r) => [r.id, { text: r.text, goal: Number(r.goal.replace(/,/g, "")) || 0 }])) }),
      t("crewOpsBoards.pledgesSaved")
    );
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);
  const board = live?.board;

  return (
    <section className={styles.card} aria-labelledby="bc-gauge">
      <div className={styles.cardHead}>
        <h2 id="bc-gauge" className={styles.cardTitle}>
          {t("crewOpsBoards.gaugeTitle")}
        </h2>
        {live && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!board?.visible}
              disabled={pending}
              onChange={(e) => run(() => setGaugeVisible({ broadcastId: live.broadcastId, on: e.target.checked }), e.target.checked ? t("crewOpsBoards.boardShown", { label: t("crewOpsBoards.gaugeLabel") }) : t("crewOpsBoards.boardHidden", { label: t("crewOpsBoards.gaugeLabel") }))}
            />
            {t("crewOps.showOnObs")}
          </label>
        )}
      </div>
      <p className={styles.note}>{t("crewOpsBoards.gaugeNote")}</p>

      <div className={prize.field}>
        <span className={styles.muted}>{t("crewOpsBoards.pledgesLabel")}</span>
        <ul className={gauge.pledges}>
          {pledgeDraft.draft.map((r) => {
            const m = members.find((x) => x.id === r.id)!;
            return (
              <li key={r.id}>
                <span className={styles.teamName}>
                  <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                  {m.name}
                  {!m.active && <span className={styles.chipOff}>{t("crewOps.resting")}</span>}
                </span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  aria-label={t("crewOpsBoards.goalAria", { name: m.name })}
                  placeholder={t("crewOpsBoards.goalPlaceholder")}
                  value={r.goal}
                  onChange={(e) => setRow(r.id, { goal: e.target.value.replace(/[^\d]/g, "").slice(0, 9) })}
                />
                <input className={styles.input} aria-label={t("crewOpsBoards.pledgeAria", { name: m.name })} placeholder={t("crewOpsBoards.pledgePlaceholder")} maxLength={PLEDGE_TEXT_MAX} value={r.text} onChange={(e) => setRow(r.id, { text: e.target.value })} />
              </li>
            );
          })}
        </ul>
        <span className={styles.note}>{t("crewOpsBoards.pledgesNote", { max: PLEDGE_TEXT_MAX })}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !pledgeDraft.dirty} onClick={() => pledgeDraft.setDraft(rowsOf())}>
            {t("crewOps.revert")}
          </button>
          <button type="button" className={styles.primary} disabled={pending || !pledgeDraft.dirty} onClick={savePledgeRows}>
            {t("crewOpsBoards.savePledges")}
          </button>
        </div>
      </div>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveGauge(draft), t("crewOpsBoards.gaugeSaved"));
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.gaugeTitleLabel")}</span>
          <input className={styles.input} aria-label={t("crewOpsBoards.gaugeTitleLabel")} placeholder={GAUGE_TITLE_DEFAULT} maxLength={PRIZE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.gaugeDisplayAria")}>
          <span className={styles.muted}>{t("crewOpsBoards.display")}</span>
          <span className={prize.inline}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.activeOnly} onChange={(e) => edit({ activeOnly: e.target.checked })} />
              {t("crewOpsBoards.activeOnly")}
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showPledge} onChange={(e) => edit({ showPledge: e.target.checked })} />
              {t("crewOpsBoards.pledgeShort")}
            </label>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.numbersAria")}>
              {GAUGE_NUMBERS.map((n) => (
                <button key={n.key} type="button" aria-pressed={draft.numbers === n.key} onClick={() => edit({ numbers: n.key })}>
                  {t(NUMBERS_KEY[n.key])}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.gaugePlacementAria")}>
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
      ) : board.rows.length === 0 ? (
        <p className={styles.empty}>{board.settings.activeOnly ? t("crewOpsBoards.gaugeEmptyActive") : t("crewOpsBoards.gaugeEmpty")}</p>
      ) : (
        <ol className={gauge.preview} aria-label={t("crewOpsBoards.gaugePreviewAria")}>
          {board.rows.map((r) => (
            <li key={r.memberId}>
              <span className={styles.boardName}>
                <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                {r.name}
                {r.reached && <span className={styles.chip}>{t("crewOpsBoards.reached")}</span>}
              </span>
              <span className={gauge.track} aria-hidden="true">
                <span className={gauge.fill} style={{ width: `${r.percent}%`, background: r.color }} />
              </span>
              <span className={styles.muted}>
                {formatNumber(r.score)} / {formatNumber(r.goal)} · {r.percent}%
              </span>
              {r.pledge && <span className={gauge.pledge}>{t("crewOpsBoards.pledgeLine", { pledge: r.pledge })}</span>}
            </li>
          ))}
        </ol>
      )}

      <BoardAddress overlayPath={overlayPath} query="?bjgauge" label={t("crewOpsBoards.gaugeLabel")} />
    </section>
  );
}
