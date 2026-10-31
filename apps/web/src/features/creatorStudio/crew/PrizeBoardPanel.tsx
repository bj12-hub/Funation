"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { movePrizeWindowStart, savePrizeBoard, setPrizeBoardVisible, startPrizeWindow, stopPrizeWindow } from "@/services/crew/crewPrizeBoard";
import { StartPointPicker } from "./StartPointPicker";
import {
  PRIZE_BASES,
  PRIZE_AUDIENCES,
  PRIZE_COLUMNS,
  PRIZE_LIMIT_MAX,
  PRIZE_PLACEMENTS,
  PRIZE_RANKS_MAX,
  PRIZE_TEXT_MAX,
  PRIZE_TITLE_DEFAULT,
  PRIZE_TITLE_MAX,
  type BroadcastResult,
  type CrewMember,
  type GaugeNumbers,
  type PrizeAudience,
  type PrizeBasis,
  type PrizeBoardLive,
  type PrizeBoardSettings,
  type PrizePlacement,
  type RankPrize,
  type WindowGaugeBasis
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import prize from "./prize.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });
/** The color picker needs a value; a line without its own color shows the theme's text color on stream. */
const PICKER_DEFAULT = "#ffffff";

type Run = (action: () => Promise<BroadcastResult>, ok?: string) => void;

/** Option labels from crewTypes as message keys (the constants stay as written; OBS shows its own text). */
export const PLACEMENT_KEY: Record<PrizePlacement, MessageKey> = { LEFT: "crewOpsBoards.placementLeft", FLOAT: "crewOpsBoards.placementFloat", RIGHT: "crewOpsBoards.placementRight" };
export const NUMBERS_KEY: Record<GaugeNumbers, MessageKey> = { SCORE: "crewOpsBoards.numbersScore", PERCENT: "crewOpsBoards.numbersPercent", BOTH: "crewOpsBoards.numbersBoth" };
export const AMOUNT_BASIS_KEY: Record<WindowGaugeBasis, MessageKey> = { AMOUNT: "crewOpsBoards.basisAmount", POINTS: "crewOpsBoards.basisPoints" };
export const PRIZE_BASIS_KEY: Record<PrizeBasis, MessageKey> = { BROADCAST: "crewOpsBoards.basisBroadcast", WINDOW: "crewOpsBoards.basisWindow" };
const AUDIENCE_KEY: Record<PrizeAudience, MessageKey> = { ALL: "crewOpsBoards.audienceAll", SCORED: "crewOpsBoards.audienceScored" };
/** Which board a toggle or 구간 bar drives (crewPrizeBoard.ts `board`). */
type BoardKey = "MEMBER" | "TEAM" | "WINDOW_GAUGE";
type Display = Pick<PrizeBoardSettings, "titleColor" | "showScore" | "showTotal" | "columns" | "placement">;

/** A settings form's draft, refilled when the saved settings change (here or in another tab). */
export function useSettingsDraft<T>(settings: T) {
  const [draft, setDraft] = useState(settings);
  const synced = useRef(JSON.stringify(settings));
  useEffect(() => {
    const next = JSON.stringify(settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(settings);
    }
  }, [settings]);
  const edit = (patch: Partial<T>) => setDraft((d) => ({ ...d, ...patch }));
  return { draft, setDraft, edit, dirty: JSON.stringify(draft) !== synced.current };
}

/** 표시: 제목 색 · 점수 · 하단 합계 · 열 개수 · 배치 (the same on 상품 순위표 and 팀 순위표). */
export function BoardDisplayField({ draft, edit }: { draft: Display; edit: (patch: Partial<Display>) => void }) {
  const { t } = useI18n();
  return (
    <div className={prize.field} role="group" aria-label={t("crewOpsBoards.display")}>
      <span className={styles.muted}>{t("crewOpsBoards.display")}</span>
      <span className={prize.inline}>
        <span className={styles.inline} role="group" aria-label={t("crewOpsBoards.titleColor")}>
          <span className={styles.muted}>{t("crewOpsBoards.titleColor")}</span>
          <input
            type="color"
            className={prize.color}
            aria-label={t("crewOpsBoards.titleColorAria")}
            value={draft.titleColor ?? PICKER_DEFAULT}
            data-default={draft.titleColor ? undefined : ""}
            onChange={(e) => edit({ titleColor: e.target.value })}
          />
          <button type="button" className={styles.ghost} disabled={!draft.titleColor} onClick={() => edit({ titleColor: null })}>
            {t("crewOpsBoards.originalColor")}
          </button>
        </span>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.showScore} onChange={(e) => edit({ showScore: e.target.checked })} />
          {t("crewOpsBoards.showScore")}
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.showTotal} onChange={(e) => edit({ showTotal: e.target.checked })} />
          {t("crewOpsBoards.showTotal")}
        </label>
        <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.columnsAria")}>
          {PRIZE_COLUMNS.map((c) => (
            <button key={c} type="button" aria-pressed={draft.columns === c} onClick={() => edit({ columns: c })}>
              {t("crewOpsBoards.columnsN", { n: c })}
            </button>
          ))}
        </span>
        <span className={styles.segment} role="group" aria-label={t("crewOpsBoards.placementAria")}>
          {PRIZE_PLACEMENTS.map((p) => (
            <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
              {t(PLACEMENT_KEY[p.key])}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}

/** 등수별 상품 · 벌칙: `lines` ranks, each a line of text and its 글자색. */
export function PrizeLinesField({ prizes, lines, note, onChange }: { prizes: RankPrize[]; lines: number; note: string; onChange: (prizes: RankPrize[]) => void }) {
  const { t } = useI18n();
  const setLine = (i: number, patch: Partial<RankPrize>) => {
    const next = Array.from({ length: Math.max(prizes.length, i + 1) }, (_, j) => prizes[j] ?? { text: "", color: null });
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div className={prize.field}>
      <span className={styles.muted}>{t("crewOpsBoards.prizeLines")}</span>
      <ol className={prize.lines}>
        {Array.from({ length: lines }, (_, i) => {
          const p = prizes[i] ?? { text: "", color: null };
          return (
            <li key={i}>
              <span className={prize.rankLabel}>{t("crewOpsBoards.rankN", { n: i + 1 })}</span>
              <input
                className={styles.input}
                aria-label={t("crewOpsBoards.rankPrizeAria", { n: i + 1 })}
                placeholder={t("crewOpsBoards.blankIsEmpty")}
                maxLength={PRIZE_TEXT_MAX}
                value={p.text}
                style={p.color ? { color: p.color } : undefined}
                onChange={(e) => setLine(i, { text: e.target.value })}
              />
              <input
                type="color"
                className={prize.color}
                aria-label={t("crewOpsBoards.rankColorAria", { n: i + 1 })}
                value={p.color ?? PICKER_DEFAULT}
                data-default={p.color ? undefined : ""}
                onChange={(e) => setLine(i, { color: e.target.value })}
              />
              <button type="button" className={styles.ghost} disabled={!p.color} onClick={() => setLine(i, { color: null })}>
                {t("crewOpsBoards.defaultColor")}
              </button>
              <input
                type="color"
                className={prize.color}
                aria-label={t("crewOpsBoards.rankOutlineAria", { n: i + 1 })}
                value={p.outline ?? "#000000"}
                data-default={p.outline ? undefined : ""}
                onChange={(e) => setLine(i, { outline: e.target.value })}
              />
              <button type="button" className={styles.ghost} disabled={!p.outline} onClick={() => setLine(i, { outline: null })}>
                {t("crewOpsBoards.noOutline")}
              </button>
            </li>
          );
        })}
      </ol>
      <span className={styles.note}>{note}</span>
    </div>
  );
}

/** The last rank with a line (−1 when none), so the editor never hides a written line. */
export const lastPrizeLine = (prizes: RankPrize[]) => prizes.reduce((last, p, i) => (p.text.trim() ? i : last), -1);

/** OBS에 표시 (the card head, while live). */
export function BoardVisibleToggle({ broadcastId, board, visible, label, pending, run }: { broadcastId: string; board: BoardKey; visible: boolean; label: string; pending: boolean; run: Run }) {
  const { t } = useI18n();
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={visible}
        disabled={pending}
        onChange={(e) => run(() => setPrizeBoardVisible({ broadcastId, board, on: e.target.checked }), e.target.checked ? t("crewOpsBoards.boardShown", { label }) : t("crewOpsBoards.boardHidden", { label }))}
      />
      {t("crewOps.showOnObs")}
    </label>
  );
}

/** 구간 시작 · 다시 시작 · 정지 of a board on the WINDOW basis, and 시작점 수정 while it runs (2026-10-28). */
export function PrizeWindowBar({ broadcastId, board, span, pending, run }: { broadcastId: string; board: BoardKey; span: PrizeBoardLive["window"]; pending: boolean; run: Run }) {
  const { t } = useI18n();
  const startId = useRef<string | null>(null);
  const start = () => {
    // One request id per intended 시작: a double click or retry never restarts the 구간 twice.
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startPrizeWindow({ broadcastId, board, requestId });
      if (res.status === "SAVED") startId.current = null;
      return res;
    }, span ? t("crewOpsBoards.windowRestarted") : t("crewOpsBoards.windowStarted"));
  };
  return (
    <div className={prize.window} role="group" aria-label={t("crewOpsBoards.windowAria")}>
      <span className={styles.muted}>
        {!span
          ? t("crewOpsBoards.windowIdle")
          : span.stoppedAt
            ? t("crewOpsBoards.windowClosed", { from: time(span.startedAt), to: time(span.stoppedAt) })
            : t("crewOpsBoards.windowRunning", { from: time(span.startedAt) })}
      </span>
      <button type="button" className={styles.primary} disabled={pending} onClick={start}>
        {span ? t("crewOpsBoards.restart") : t("crewOpsBoards.start")}
      </button>
      {span && !span.stoppedAt && (
        <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => stopPrizeWindow({ broadcastId, board }), t("crewOpsBoards.windowStopped"))}>
          {t("crewOpsBoards.stop")}
        </button>
      )}
      {span && !span.stoppedAt && (
        <StartPointPicker
          current={span.startedAt}
          pending={pending}
          onMove={(at) => run(() => movePrizeWindowStart({ broadcastId, board, at }), t("crewOpsBoards.windowMoved", { time: time(at) }))}
        />
      )}
    </div>
  );
}

/** The board's OBS address (`?prize` · `?teamprize`) with a copy button. */
export function BoardAddress({ overlayPath, query, label }: { overlayPath: string; query: string; label: string }) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className={styles.addRow}>
      <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, query)} readOnly aria-label={t("crewOpsBoards.addressAria", { label })} onFocus={(e) => e.target.select()} />
      <CopyButton value={`${origin}${overlayPath}${query}`} label={t("crewOpsBroadcast.copy")} className={styles.ghost} />
    </div>
  );
}

/**
 * 상품 순위표 — code-first (no Figma frame; StreamDonate 랭킹(상품) · 시간 내 랭킹 참고), inside `/creator/crew/broadcast`.
 * Settings can be edited before going live and are saved with 설정 저장; OBS에 표시 and the 구간 (시작 ~ 정지) work while
 * live. The preview below is the server's ranking under the saved settings.
 */
export function PrizeBoardPanel({
  settings,
  live,
  members,
  overlayPath,
  pending,
  run
}: {
  settings: PrizeBoardSettings;
  live: { broadcastId: string; board: PrizeBoardLive } | null;
  members: CrewMember[];
  overlayPath: string;
  pending: boolean;
  run: Run;
}) {
  const { t } = useI18n();
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);

  // Members a rank can go to: listed ones (active, on this broadcast's board, or pinned) minus 제외 and 상단 고정.
  const listed = members.filter((m) => m.active || m.id === draft.pinned?.memberId || live?.board.rows.some((r) => r.memberId === m.id));
  const rankable = listed.filter((m) => !draft.excluded.includes(m.id) && m.id !== draft.pinned?.memberId).length;
  const lines = Math.min(PRIZE_RANKS_MAX, Math.max(1, rankable, lastPrizeLine(draft.prizes) + 1));
  const toggleExcluded = (id: string) =>
    edit({
      excluded: draft.excluded.includes(id) ? draft.excluded.filter((x) => x !== id) : [...draft.excluded, id],
      pinned: draft.pinned?.memberId === id ? null : draft.pinned
    });

  const board = live?.board;

  return (
    <section className={styles.card} aria-labelledby="bc-prize">
      <div className={styles.cardHead}>
        <h2 id="bc-prize" className={styles.cardTitle}>
          {t("crewOpsBoards.prizeTitle")}
        </h2>
        {live && <BoardVisibleToggle broadcastId={live.broadcastId} board="MEMBER" visible={!!board?.visible} label={t("crewOpsBoards.prizeTitle")} pending={pending} run={run} />}
      </div>
      <p className={styles.note}>{t("crewOpsBoards.prizeNote")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          // A member removed from the crew since may still be in 제외 / 상단 고정: drop it instead of failing the save.
          const known = new Set(members.map((m) => m.id));
          const next = { ...draft, excluded: draft.excluded.filter((id) => known.has(id)), pinned: draft.pinned && known.has(draft.pinned.memberId) ? draft.pinned : null };
          run(() => savePrizeBoard(next), t("crewOpsBoards.prizeSaved"));
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.titleLabel")}</span>
          <input
            className={styles.input}
            aria-label={t("crewOpsBoards.prizeTitleAria")}
            placeholder={PRIZE_TITLE_DEFAULT}
            maxLength={PRIZE_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.basisLabel")}>
          <span className={styles.muted}>{t("crewOpsBoards.basisLabel")}</span>
          <span className={styles.segment}>
            {PRIZE_BASES.map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {t(PRIZE_BASIS_KEY[b.key])}
              </button>
            ))}
          </span>
        </div>
        <BoardDisplayField draft={draft} edit={edit} />
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.pinLabel")}</span>
          <span className={prize.inline}>
            <select
              className={styles.select}
              aria-label={t("crewOpsBoards.pinAria")}
              value={draft.pinned?.memberId ?? ""}
              onChange={(e) => edit({ pinned: e.target.value ? { memberId: e.target.value, text: draft.pinned?.text ?? "" } : null })}
            >
              <option value="">{t("crewOpsBoards.notUsed")}</option>
              {listed
                .filter((m) => !draft.excluded.includes(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
            {draft.pinned && (
              <input
                className={styles.input}
                aria-label={t("crewOpsBoards.pinTextAria")}
                placeholder={t("crewOpsBoards.pinTextPlaceholder")}
                maxLength={PRIZE_TEXT_MAX}
                value={draft.pinned.text}
                onChange={(e) => edit({ pinned: { memberId: draft.pinned!.memberId, text: e.target.value } })}
              />
            )}
          </span>
          <span className={styles.note}>{t("crewOpsBoards.pinNote")}</span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.audienceLabel")}>
          <span className={styles.muted}>{t("crewOpsBoards.audienceLabel")}</span>
          <span className={prize.inline}>
            <span className={styles.segment}>
              {PRIZE_AUDIENCES.map((a) => (
                <button key={a.key} type="button" aria-pressed={draft.audience === a.key} onClick={() => edit({ audience: a.key })}>
                  {t(AUDIENCE_KEY[a.key])}
                </button>
              ))}
            </span>
            {draft.audience === "SCORED" && (
              <>
                <span className={styles.muted}>{t("crewOpsBoards.top")}</span>
                <input
                  className={styles.inputSmall}
                  type="number"
                  min={1}
                  max={PRIZE_LIMIT_MAX}
                  aria-label={t("crewOpsBoards.topAria")}
                  style={{ width: 80, flex: "none" }}
                  value={draft.limit}
                  onChange={(e) => edit({ limit: Math.max(1, Math.min(PRIZE_LIMIT_MAX, Math.trunc(Number(e.target.value) || 1))) })}
                />
                <span className={styles.muted}>{t("crewOpsBoards.peopleUnit")}</span>
              </>
            )}
          </span>
          <span className={styles.note}>{t("crewOpsBoards.audienceNote")}</span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.excludeLabel")}>
          <span className={styles.muted}>{t("crewOpsBoards.excludeLabel")}</span>
          <span className={prize.chips}>
            {listed.length === 0 && <span className={styles.note}>{t("crewOpsBoards.noActiveMembers")}</span>}
            {listed.map((m) => (
              <button key={m.id} type="button" className={prize.chip} aria-pressed={draft.excluded.includes(m.id)} onClick={() => toggleExcluded(m.id)}>
                <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                {m.name}
              </button>
            ))}
          </span>
        </div>

        <PrizeLinesField
          prizes={draft.prizes}
          lines={lines}
          note={t("crewOpsBoards.prizeLinesNote")}
          onChange={(prizes) => edit({ prizes })}
        />

        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            {t("crewOps.revert")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            {t("crewOps.saveSettings")}
          </button>
        </div>
      </form>

      {!live ? (
        <p className={styles.note}>{t("crewOpsBoards.prizeIdle")}</p>
      ) : (
        <>
          {settings.basis === "WINDOW" && <PrizeWindowBar broadcastId={live.broadcastId} board="MEMBER" span={board?.window ?? null} pending={pending} run={run} />}
          {dirty && <p className={styles.note}>{t("crewOpsBoards.unsavedPreview")}</p>}
          {board && board.rows.length > 0 ? (
            <ol className={prize.preview} aria-label={t("crewOpsBoards.prizePreviewAria")}>
              {board.rows.map((r) => (
                <li key={r.memberId} data-pinned={r.rank === null ? "" : undefined}>
                  <span className={styles.rankNo}>{r.rank ?? t("crewOpsBoards.pinned")}</span>
                  <span className={styles.boardName}>
                    <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                    {r.name}
                  </span>
                  <span className={prize.previewPrize} style={r.prize?.color ? { color: r.prize.color } : undefined}>
                    {r.prize?.text ?? ""}
                  </span>
                  <strong>{formatNumber(r.score)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>{t("crewOpsBoards.noRankable")}</p>
          )}
          {board && board.settings.showTotal && <p className={styles.muted}>{t("crewOpsBoards.totalPoints", { n: formatNumber(board.total) })}</p>}
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?prize" label={t("crewOpsBoards.prizeTitle")} />
    </section>
  );
}
