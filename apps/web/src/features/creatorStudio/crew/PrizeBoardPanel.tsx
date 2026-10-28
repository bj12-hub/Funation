"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { movePrizeWindowStart, savePrizeBoard, setPrizeBoardVisible, startPrizeWindow, stopPrizeWindow } from "@/services/crew/crewPrizeBoard";
import { StartPointPicker } from "./StartPointPicker";
import {
  PRIZE_BASES,
  PRIZE_COLUMNS,
  PRIZE_PLACEMENTS,
  PRIZE_RANKS_MAX,
  PRIZE_TEXT_MAX,
  PRIZE_TITLE_DEFAULT,
  PRIZE_TITLE_MAX,
  type BroadcastResult,
  type CrewMember,
  type PrizeBoardLive,
  type PrizeBoardSettings,
  type RankPrize
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import prize from "./prize.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });
/** The color picker needs a value; a line without its own color shows the theme's text color on stream. */
const PICKER_DEFAULT = "#ffffff";

type Run = (action: () => Promise<BroadcastResult>, ok?: string) => void;
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
  return (
    <div className={prize.field} role="group" aria-label="표시">
      <span className={styles.muted}>표시</span>
      <span className={prize.inline}>
        <span className={styles.inline} role="group" aria-label="제목 색">
          <span className={styles.muted}>제목 색</span>
          <input
            type="color"
            className={prize.color}
            aria-label="제목 글자색"
            value={draft.titleColor ?? PICKER_DEFAULT}
            data-default={draft.titleColor ? undefined : ""}
            onChange={(e) => edit({ titleColor: e.target.value })}
          />
          <button type="button" className={styles.ghost} disabled={!draft.titleColor} onClick={() => edit({ titleColor: null })}>
            원래 색
          </button>
        </span>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.showScore} onChange={(e) => edit({ showScore: e.target.checked })} />
          점수
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.showTotal} onChange={(e) => edit({ showTotal: e.target.checked })} />
          하단 합계
        </label>
        <span className={styles.segment} role="group" aria-label="열 개수">
          {PRIZE_COLUMNS.map((c) => (
            <button key={c} type="button" aria-pressed={draft.columns === c} onClick={() => edit({ columns: c })}>
              {c}열
            </button>
          ))}
        </span>
        <span className={styles.segment} role="group" aria-label="배치">
          {PRIZE_PLACEMENTS.map((p) => (
            <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
              {p.label}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}

/** 등수별 상품 · 벌칙: `lines` ranks, each a line of text and its 글자색. */
export function PrizeLinesField({ prizes, lines, note, onChange }: { prizes: RankPrize[]; lines: number; note: string; onChange: (prizes: RankPrize[]) => void }) {
  const setLine = (i: number, patch: Partial<RankPrize>) => {
    const next = Array.from({ length: Math.max(prizes.length, i + 1) }, (_, j) => prizes[j] ?? { text: "", color: null });
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div className={prize.field}>
      <span className={styles.muted}>등수별 상품 · 벌칙</span>
      <ol className={prize.lines}>
        {Array.from({ length: lines }, (_, i) => {
          const p = prizes[i] ?? { text: "", color: null };
          return (
            <li key={i}>
              <span className={prize.rankLabel}>{i + 1}등</span>
              <input
                className={styles.input}
                aria-label={`${i + 1}등 상품 · 벌칙`}
                placeholder="비우면 빈칸"
                maxLength={PRIZE_TEXT_MAX}
                value={p.text}
                style={p.color ? { color: p.color } : undefined}
                onChange={(e) => setLine(i, { text: e.target.value })}
              />
              <input
                type="color"
                className={prize.color}
                aria-label={`${i + 1}등 글자색`}
                value={p.color ?? PICKER_DEFAULT}
                data-default={p.color ? undefined : ""}
                onChange={(e) => setLine(i, { color: e.target.value })}
              />
              <button type="button" className={styles.ghost} disabled={!p.color} onClick={() => setLine(i, { color: null })}>
                기본색
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
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={visible}
        disabled={pending}
        onChange={(e) => run(() => setPrizeBoardVisible({ broadcastId, board, on: e.target.checked }), e.target.checked ? `OBS에 ${label}를 띄웠어요.` : `${label}를 내렸어요.`)}
      />
      OBS에 표시
    </label>
  );
}

/** 구간 시작 · 다시 시작 · 정지 of a board on the WINDOW basis, and 시작점 수정 while it runs (2026-10-28). */
export function PrizeWindowBar({ broadcastId, board, span, pending, run }: { broadcastId: string; board: BoardKey; span: PrizeBoardLive["window"]; pending: boolean; run: Run }) {
  const startId = useRef<string | null>(null);
  const start = () => {
    // One request id per intended 시작: a double click or retry never restarts the 구간 twice.
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startPrizeWindow({ broadcastId, board, requestId });
      if (res.status === "SAVED") startId.current = null;
      return res;
    }, span ? "구간을 처음부터 다시 셀게요." : "구간 집계를 시작했어요.");
  };
  return (
    <div className={prize.window} role="group" aria-label="구간 집계">
      <span className={styles.muted}>
        {!span ? "구간 시작 전 — 시작을 누른 뒤 들어온 후원만 세요." : span.stoppedAt ? `마감 · ${time(span.startedAt)} ~ ${time(span.stoppedAt)}` : `집계 중 · ${time(span.startedAt)}부터`}
      </span>
      <button type="button" className={styles.primary} disabled={pending} onClick={start}>
        {span ? "다시 시작" : "시작"}
      </button>
      {span && !span.stoppedAt && (
        <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => stopPrizeWindow({ broadcastId, board }), "구간을 마감했어요.")}>
          정지
        </button>
      )}
      {span && !span.stoppedAt && (
        <StartPointPicker
          current={span.startedAt}
          pending={pending}
          onMove={(at) => run(() => movePrizeWindowStart({ broadcastId, board, at }), `구간을 ${time(at)}부터 다시 셀게요.`)}
        />
      )}
    </div>
  );
}

/** The board's OBS address (`?prize` · `?teamprize`) with a copy button. */
export function BoardAddress({ overlayPath, query, label }: { overlayPath: string; query: string; label: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className={styles.addRow}>
      <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, query)} readOnly aria-label={`${label} 오버레이 주소`} onFocus={(e) => e.target.select()} />
      <CopyButton value={`${origin}${overlayPath}${query}`} label="복사" className={styles.ghost} />
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
          상품 순위표
        </h2>
        {live && <BoardVisibleToggle broadcastId={live.broadcastId} board="MEMBER" visible={!!board?.visible} label="상품 순위표" pending={pending} run={run} />}
      </div>
      <p className={styles.note}>
        등수마다 상품 · 벌칙을 적어 OBS에 띄우는 순위표예요. 방송 전체 점수나, 시작 ~ 정지 사이 구간 점수(받은 후원 ± 강탈, 보정 제외)로 순위를 매겨요. 상품은 화면 문구일 뿐
        지급되지 않아요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          // A member removed from the crew since may still be in 제외 / 상단 고정: drop it instead of failing the save.
          const known = new Set(members.map((m) => m.id));
          const next = { ...draft, excluded: draft.excluded.filter((id) => known.has(id)), pinned: draft.pinned && known.has(draft.pinned.memberId) ? draft.pinned : null };
          run(() => savePrizeBoard(next), "상품 순위표 설정을 저장했어요.");
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>제목</span>
          <input
            className={styles.input}
            aria-label="순위표 제목"
            placeholder={PRIZE_TITLE_DEFAULT}
            maxLength={PRIZE_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <div className={prize.field} role="group" aria-label="집계 기준">
          <span className={styles.muted}>집계 기준</span>
          <span className={styles.segment}>
            {PRIZE_BASES.map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {b.label}
              </button>
            ))}
          </span>
        </div>
        <BoardDisplayField draft={draft} edit={edit} />
        <div className={prize.field}>
          <span className={styles.muted}>상단 고정</span>
          <span className={prize.inline}>
            <select
              className={styles.select}
              aria-label="상단 고정 멤버"
              value={draft.pinned?.memberId ?? ""}
              onChange={(e) => edit({ pinned: e.target.value ? { memberId: e.target.value, text: draft.pinned?.text ?? "" } : null })}
            >
              <option value="">사용 안 함</option>
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
                aria-label="고정 문구"
                placeholder="고정 문구 (예: MC)"
                maxLength={PRIZE_TEXT_MAX}
                value={draft.pinned.text}
                onChange={(e) => edit({ pinned: { memberId: draft.pinned!.memberId, text: e.target.value } })}
              />
            )}
          </span>
          <span className={styles.note}>고정한 멤버는 1등 위에 따로 보이고 등수에서 빠져요. 나머지가 1등부터 다시 매겨져요.</span>
        </div>
        <div className={prize.field} role="group" aria-label="순위에서 뺄 멤버">
          <span className={styles.muted}>순위에서 뺄 멤버</span>
          <span className={prize.chips}>
            {listed.length === 0 && <span className={styles.note}>활동 중인 멤버가 없어요.</span>}
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
          note="칸 수는 순위에 들어가는 멤버 수예요. 글자색을 고르지 않으면 오버레이 테마의 글자색으로 보여요."
          onChange={(prizes) => edit({ prizes })}
        />

        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            설정 저장
          </button>
        </div>
      </form>

      {!live ? (
        <p className={styles.note}>방송을 시작하면 실시간 미리보기와 OBS 표시 · 구간 시작 버튼이 나와요.</p>
      ) : (
        <>
          {settings.basis === "WINDOW" && <PrizeWindowBar broadcastId={live.broadcastId} board="MEMBER" span={board?.window ?? null} pending={pending} run={run} />}
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 미리보기와 OBS는 저장한 설정으로 보여요.</p>}
          {board && board.rows.length > 0 ? (
            <ol className={prize.preview} aria-label="상품 순위표 미리보기">
              {board.rows.map((r) => (
                <li key={r.memberId} data-pinned={r.rank === null ? "" : undefined}>
                  <span className={styles.rankNo}>{r.rank ?? "고정"}</span>
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
            <p className={styles.empty}>순위에 넣을 멤버가 없어요.</p>
          )}
          {board && board.settings.showTotal && <p className={styles.muted}>합계 {formatNumber(board.total)}점</p>}
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?prize" label="상품 순위표" />
    </section>
  );
}
