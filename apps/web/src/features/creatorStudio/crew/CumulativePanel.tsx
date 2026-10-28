"use client";

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
  type CumulativeSettings
} from "@/services/crew/crewTypes";
import { BoardAddress, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import prize from "./prize.module.css";

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
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);
  const board = live?.board;
  return (
    <section className={styles.card} aria-labelledby="bc-cumulative">
      <div className={styles.cardHead}>
        <h2 id="bc-cumulative" className={styles.cardTitle}>
          누적 기여도
        </h2>
        {live && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!board?.visible}
              disabled={pending}
              onChange={(e) =>
                run(() => setCumulativeVisible({ broadcastId: live.broadcastId, on: e.target.checked }), e.target.checked ? "OBS에 누적 기여도를 띄웠어요." : "누적 기여도를 내렸어요.")
              }
            />
            OBS에 표시
          </label>
        )}
      </div>
      <p className={styles.note}>
        같은 프로젝트로 진행한 회차를 더해 멤버별로 보여 줘요. 기여도는 각 회차의 최종 점수, 후원금은 멤버가 받은 후원(멤버 지정 · 배정된 후원 리스트)을 자동엑셀 기준 단위로 배수 전에
        더해요. 프로젝트 없이 시작한 방송은 이번 방송만 세요. BJ 목록 순서는 크루 관리의 멤버 순서대로 순위 뱃지 없이 보여 줘요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCumulative(draft), "누적 기여도 설정을 저장했어요.");
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>제목</span>
          <input className={styles.input} aria-label="누적 기여도 제목" placeholder={CUMULATIVE_TITLE_DEFAULT} maxLength={PRIZE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>집계 기준</span>
          <span className={styles.segment} role="group" aria-label="누적 기여도 집계 기준">
            {[...WINDOW_GAUGE_BASES].reverse().map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {b.label}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label="누적 기여도 표시">
          <span className={styles.muted}>표시</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label="보여 줄 멤버 수">
              {CUMULATIVE_ROWS.map((n) => (
                <button key={n} type="button" aria-pressed={draft.rows === n} onClick={() => edit({ rows: n })}>
                  {draft.sort === "ORDER" ? `${n}명` : `상위 ${n}명`}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label="누적 기여도 정렬">
              {CUMULATIVE_SORTS.map((x) => (
                <button key={x.key} type="button" aria-pressed={draft.sort === x.key} onClick={() => edit({ sort: x.key })}>
                  {x.label}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showBreakdown} onChange={(e) => edit({ showBreakdown: e.target.checked })} />
              지난 회차 · 이번 회차
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showRounds} onChange={(e) => edit({ showRounds: e.target.checked })} />
              프로젝트 · 회차 수
            </label>
            <span className={styles.segment} role="group" aria-label="누적 기여도 배치">
              {PRIZE_PLACEMENTS.map((p) => (
                <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
                  {p.label}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            설정 저장
          </button>
        </div>
      </form>

      {!board ? (
        <p className={styles.note}>방송을 시작하면 실시간 미리보기와 OBS 표시 버튼이 나와요.</p>
      ) : (
        <>
          <p className={styles.muted}>{board.project ? `${board.project} · ${board.rounds}회차까지 누적 (이번 회차 포함)` : "프로젝트 없이 시작한 방송이라 이번 방송만 보여요."}</p>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. OBS는 저장한 설정으로 보여요.</p>}
          {board.rows.length ? (
            <ol className={prize.preview} aria-label="누적 기여도 미리보기">
              {board.rows.map((r) => (
                <li key={r.memberId}>
                  <span className={styles.rankNo}>{r.rank}</span>
                  <span className={styles.boardName}>
                    <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                    {r.name}
                  </span>
                  <span className={prize.previewPrize}>
                    지난 {cumulativeText(r.past, board.unit)} · 이번 {cumulativeText(r.current, board.unit)}
                  </span>
                  <strong>{cumulativeText(r.total, board.unit)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>순위에 넣을 멤버가 없어요.</p>
          )}
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?cumulative" label="누적 기여도" />
    </section>
  );
}
