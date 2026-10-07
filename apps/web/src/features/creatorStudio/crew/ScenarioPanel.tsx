"use client";

import { useEffect, useRef, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { finishScenario, setScenario, startScenarioPart } from "@/services/crew/crewScenario";
import {
  SCENARIO_MEMO_MAX,
  SCENARIO_PARTS_MAX,
  SCENARIO_TITLE_MAX,
  type BroadcastResult,
  type ScenarioLive,
  type ScenarioPart
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import styles from "./crew.module.css";
import scen from "./scenario.module.css";

type Row = { title: string; minutes: string; memo: string; openBoard: boolean };
const toRow = (p: ScenarioPart): Row => ({ title: p.title, minutes: p.minutes === null ? "" : String(p.minutes), memo: p.memo, openBoard: p.openBoard });
const toPart = (r: Row): ScenarioPart => ({ title: r.title.trim(), minutes: r.minutes ? Number(r.minutes) : null, memo: r.memo.trim(), openBoard: r.openBoard });
export const partName = (i: number, p: ScenarioPart | undefined) => `${i + 1}부${p?.title ? ` · ${p.title}` : ""}`;
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** Seconds since the running part started (server clock, corrected for the browser's skew; null before mount). */
export function usePartElapsed(live: ScenarioLive | null, serverNow: string | null) {
  const now = useServerClock(serverNow);
  const started = live && live.current !== null ? live.history.at(-1)?.startedAt : undefined;
  return !started || now === null ? null : Math.max(0, Math.floor((now - new Date(started).getTime()) / 1000));
}

/**
 * 콘텐츠 시나리오 도우미 — code-first (no Figma frame), on `/creator/crew/broadcast`. Plan 1부 ~ 5부
 * before going live (saved on every edit); while live, move part to part. Parts can open a 서브 점수판.
 */
export function ScenarioPanel({
  plan,
  live,
  overlayPath,
  pending,
  run
}: {
  plan: ScenarioPart[];
  /** Set while a broadcast is live (`serverNow`: the server clock when the view was read). */
  live: { broadcastId: string; scenario: ScenarioLive | null; serverNow: string } | null;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => plan.map(toRow));
  const synced = useRef(JSON.stringify(plan));
  useEffect(() => {
    const next = JSON.stringify(plan);
    if (next !== synced.current) {
      synced.current = next;
      setRows(plan.map(toRow));
    }
  }, [plan]);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const elapsed = usePartElapsed(live?.scenario ?? null, live?.serverNow ?? null);

  const save = (next: Row[]) => {
    setRows(next);
    run(() => setScenario({ parts: next.map(toPart) }));
  };
  const edit = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const running = live?.scenario ?? null;
  const parts = running?.parts ?? plan;
  const current = running?.current ?? null;
  const next = current === null ? (running ? null : 0) : current + 1 < parts.length ? current + 1 : null;
  const go = (index: number) => live && run(() => startScenarioPart({ broadcastId: live.broadcastId, index, requestId: crypto.randomUUID() }), `${index + 1}부를 시작했어요.`);
  const part = current === null ? undefined : parts[current];
  const over = part?.minutes && elapsed !== null && elapsed > part.minutes * 60;

  return (
    <section className={styles.card} aria-labelledby="bc-scenario">
      <div className={styles.cardHead}>
        <h2 id="bc-scenario" className={styles.cardTitle}>
          콘텐츠 시나리오
        </h2>
        {part && (
          <span className={scen.clock} data-over={over ? "" : undefined}>
            {elapsed === null ? "--:--" : mmss(elapsed)}
            {part.minutes ? ` / ${part.minutes}분` : ""}
          </span>
        )}
      </div>
      <p className={styles.note}>1부부터 {SCENARIO_PARTS_MAX}부까지 방송 흐름을 미리 짜 두고, 방송 중에 다음 부로 넘기세요. 부를 시작할 때 서브 점수판을 자동으로 열 수 있어요.</p>

      {live && parts.length > 0 && (
        <div className={scen.live}>
          <ol className={scen.steps}>
            {parts.map((p, i) => {
              const done = running?.history.some((h) => h.index === i && h.endedAt);
              return (
                <li key={i} data-state={i === current ? "current" : done ? "done" : undefined}>
                  <button type="button" className={scen.step} disabled={pending || i === current} onClick={() => go(i)} aria-current={i === current ? "step" : undefined}>
                    <strong>{partName(i, p)}</strong>
                    <span className={styles.muted}>{p.minutes ? `${p.minutes}분` : "시간 미정"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {part ? (
            <div className={scen.now}>
              <strong>지금 · {partName(current!, part)}</strong>
              {part.memo && <p className={scen.memo}>{part.memo}</p>}
              {over && <p className={styles.error}>예정 시간을 넘겼어요.</p>}
            </div>
          ) : (
            <p className={styles.muted}>{running ? "시나리오를 마쳤어요. 부를 눌러 다시 이어 갈 수 있어요." : "1부를 시작하면 시간이 재져요."}</p>
          )}
          <div className={styles.actions}>
            {next !== null && (
              <button type="button" className={styles.primary} disabled={pending} onClick={() => go(next)}>
                {current === null ? `${next + 1}부 시작` : `다음: ${partName(next, parts[next])}`}
              </button>
            )}
            {current !== null && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => finishScenario({ broadcastId: live.broadcastId }), "시나리오를 마쳤어요.")}>
                시나리오 마치기
              </button>
            )}
          </div>
          {running && <p className={styles.note}>진행 중인 방송은 처음 부를 시작할 때의 시나리오로 진행돼요. 아래에서 고친 내용은 다음 방송부터 적용돼요.</p>}
        </div>
      )}

      <details className={styles.logs} open={!live || !rows.length}>
        <summary>시나리오 편집 ({rows.length}/{SCENARIO_PARTS_MAX}부)</summary>
        <ol className={scen.editor}>
          {rows.map((r, i) => (
            <li key={i}>
              <span className={scen.no}>{i + 1}부</span>
              <input className={styles.input} aria-label={`${i + 1}부 이름`} placeholder="이름 (예: 오프닝 · 직급전)" value={r.title} maxLength={SCENARIO_TITLE_MAX} onChange={(e) => edit(i, { title: e.target.value })} onBlur={() => save(rows)} />
              <input
                className={styles.inputSmall}
                inputMode="numeric"
                aria-label={`${i + 1}부 예정 시간(분)`}
                placeholder="분"
                value={r.minutes}
                onChange={(e) => edit(i, { minutes: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                onBlur={() => save(rows)}
              />
              <input className={styles.input} aria-label={`${i + 1}부 메모`} placeholder="메모 (진행 내용 · 미션)" value={r.memo} maxLength={SCENARIO_MEMO_MAX} onChange={(e) => edit(i, { memo: e.target.value })} onBlur={() => save(rows)} />
              <label className={styles.checkRow}>
                <input type="checkbox" checked={r.openBoard} onChange={(e) => save(rows.map((x, j) => (j === i ? { ...x, openBoard: e.target.checked } : x)))} />
                서브 점수판
              </label>
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => save(rows.filter((_, j) => j !== i))}>
                삭제
              </button>
            </li>
          ))}
        </ol>
        {rows.length < SCENARIO_PARTS_MAX && (
          <button type="button" className={styles.ghost} onClick={() => save([...rows, { title: "", minutes: "", memo: "", openBoard: false }])}>
            + {rows.length + 1}부 추가
          </button>
        )}
      </details>

      <div className={styles.addRow}>
        <input className={styles.input} value={`${origin}${overlayPath}?scenario`} readOnly aria-label="시나리오 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={`${origin}${overlayPath}?scenario`} label="복사" className={styles.ghost} />
      </div>
    </section>
  );
}
