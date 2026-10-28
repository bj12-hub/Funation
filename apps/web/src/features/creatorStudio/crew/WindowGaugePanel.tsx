"use client";

import { formatNumber } from "@/lib/format";
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
import { BoardAddress, BoardVisibleToggle, PrizeWindowBar, useSettingsDraft } from "./PrizeBoardPanel";
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
  // Amounts are typed as text and sent as numbers.
  const toDraft = (s: WindowGaugeSettings) => ({ ...s, goal: String(s.goal), autoRaise: s.autoRaise ? String(s.autoRaise) : "" });
  const { draft, setDraft, edit, dirty } = useSettingsDraft(toDraft(settings));
  const board = live?.board;
  return (
    <section className={styles.card} aria-labelledby="bc-windowgauge">
      <div className={styles.cardHead}>
        <h2 id="bc-windowgauge" className={styles.cardTitle}>
          시간 내 통합 게이지
        </h2>
        {live && <BoardVisibleToggle broadcastId={live.broadcastId} board="WINDOW_GAUGE" visible={!!board?.visible} label="구간 게이지" pending={pending} run={run} />}
      </div>
      <p className={styles.note}>
        시작 ~ 정지 사이에 들어온 후원만 크루 전체로 모아 목표까지 채우는 게이지예요. 후원금은 멤버 지정 · 미지정 후원을 모두 자동엑셀 단위로 더하고, 기여도는 멤버들이 그 구간에 받은
        점수(배수 규칙 · 점수 게임 포함)를 더해요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveWindowGauge({ ...draft, goal: Number(draft.goal) || 0, autoRaise: Number(draft.autoRaise) || 0 }), "구간 게이지 설정을 저장했어요.");
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>제목</span>
          <input className={styles.input} aria-label="구간 게이지 제목" placeholder={WINDOW_GAUGE_TITLE_DEFAULT} maxLength={PRIZE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
        </div>
        <div className={prize.field} role="group" aria-label="구간 게이지 집계 기준">
          <span className={styles.muted}>집계 기준</span>
          <span className={styles.segment}>
            {WINDOW_GAUGE_BASES.map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {b.label}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>목표 · 자동 증량</span>
          <span className={prize.inline}>
            <input className={styles.input} inputMode="numeric" aria-label="구간 게이지 목표" placeholder="목표" value={draft.goal} onChange={(e) => edit({ goal: digits(e.target.value) })} />
            <input className={styles.input} inputMode="numeric" aria-label="자동 증량" placeholder="자동 증량 (비우면 끔)" value={draft.autoRaise} onChange={(e) => edit({ autoRaise: digits(e.target.value) })} />
          </span>
          <span className={styles.note}>목표를 넘으면 자동 증량만큼 목표가 올라가요. 단위는 집계 기준을 따라요 — 후원금은 자동엑셀 기준(FN 또는 원), 기여도는 점.</span>
        </div>
        <div className={prize.field} role="group" aria-label="구간 게이지 표시">
          <span className={styles.muted}>표시</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label="구간 게이지 숫자 표시">
              {GAUGE_NUMBERS.map((n) => (
                <button key={n.key} type="button" aria-pressed={draft.numbers === n.key} onClick={() => edit({ numbers: n.key })}>
                  {n.label}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label="구간 게이지 배치">
              {PRIZE_PLACEMENTS.map((p) => (
                <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
                  {p.label}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(settings))}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty || !Number(draft.goal)}>
            설정 저장
          </button>
        </div>
      </form>

      {!live || !board ? (
        <p className={styles.note}>방송을 시작하면 구간 시작 · 정지와 OBS 표시 버튼이 나와요.</p>
      ) : (
        <>
          <PrizeWindowBar broadcastId={live.broadcastId} board="WINDOW_GAUGE" span={board.window} pending={pending} run={run} />
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 미리보기와 OBS는 저장한 설정으로 보여요.</p>}
          <div className={gauge.preview} aria-label="구간 게이지 미리보기">
            <span className={gauge.track} aria-hidden="true">
              <span className={gauge.fill} style={{ width: `${board.percent}%`, background: "var(--color-primary)" }} />
            </span>
            <span className={styles.muted}>
              {formatNumber(board.current)} / {formatNumber(board.target)} {board.unit} · {board.percent}% · 후원 {formatNumber(board.count)}건
              {board.target > board.settings.goal && " · 목표 자동 증량됨"}
            </span>
          </div>
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?windowgauge" label="구간 게이지" />
    </section>
  );
}
