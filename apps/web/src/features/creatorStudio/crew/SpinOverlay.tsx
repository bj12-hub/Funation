"use client";

import { useState, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SPIN_REEL_SEC, SPIN_RESULT_SEC, SPIN_TITLE_DEFAULT, type GameRunView, type SpinLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import board from "./overlay.module.css";
import styles from "./spinOverlay.module.css";

/** Reel rows: copies of the items the strip runs through before it lands on the result. */
const LOOPS = 5;

/** The result line under a label: "×2 · +3,000점", "+1,000점", "" for a 문구, "꽝" for a miss. */
export function spinEffect(r: Pick<GameRunView, "kind" | "value" | "points" | "basePoints">) {
  if (r.kind === "MULTIPLY") return r.basePoints ? `×${r.value} · +${formatNumber(r.points)}점` : `×${r.value} · 기준 후원 없음`;
  if (r.kind === "ADD") return `+${formatNumber(r.points)}점`;
  return r.kind === "MISS" ? "꽝" : "";
}

/** The run playing at `now` (its reel or its result), if any. */
export const currentRun = (runs: GameRunView[], now: number) =>
  runs.find((r) => Date.parse(r.showAt) <= now && now < Date.parse(r.showAt) + (SPIN_REEL_SEC + SPIN_RESULT_SEC) * 1000) ?? null;

/**
 * One run's reel, keyed by the run: the strip scrolls through the items and stops on the result (the server's draw). The
 * start offset is fixed when it mounts, so a page loaded mid-spin picks the reel up where it is.
 */
function Reel({ run, labels, now }: { run: GameRunView; labels: string[]; now: number }) {
  const [elapsed] = useState(() => Math.max(0, (now - Date.parse(run.showAt)) / 1000));
  const items = labels.length ? labels : [run.label];
  const strip = Array.from({ length: LOOPS }, () => items).flat();
  const at = items.indexOf(run.label);
  const target = (LOOPS - 2) * items.length + Math.max(0, at);
  strip[target] = run.label;
  const style = { "--reel-end": `calc(var(--spin-row) * ${-(target - 1)})`, "--reel-sec": `${SPIN_REEL_SEC}s`, animationDelay: `-${elapsed}s` } as CSSProperties;
  return (
    <ol className={`${styles.strip} ${styles.spinning}`} style={style} aria-hidden="true">
      {strip.map((label, i) => (
        <li key={i} className={ov.display}>
          {label}
        </li>
      ))}
    </ol>
  );
}

/**
 * 스핀머신 overlay (`?spin`): queued runs play one after another — the reel spins, then the member and the result show.
 * Between runs the machine rests on the first item (대기 중에도 보이기), or the page stays empty. Timed on the server clock.
 */
export function SpinMachineOverlay({ spin, serverNow, reloadSeq, theme }: { spin: SpinLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!spin || now === null) return null;
  const labels = spin.settings.items.map((i) => i.label);
  const run = currentRun(spin.runs, now);
  if (!run && (!spin.settings.showIdle || !labels.length)) return null;
  const waiting = spin.runs.filter((r) => Date.parse(r.showAt) > now).length;
  const shown = run && now >= Date.parse(run.revealAt);
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <div className={`${ov.card} ${styles.machine}`}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {spin.settings.title || SPIN_TITLE_DEFAULT}
          {waiting > 0 && <span className={`${ov.chip} ${styles.queue}`}>대기 {waiting}</span>}
        </h1>
        <div className={styles.window} data-hit={shown || undefined}>
          {run ? (
            <Reel key={run.id} run={run} labels={labels} now={now} />
          ) : (
            <ol className={styles.strip} aria-hidden="true">
              {[labels.at(-1), labels[0], labels[1 % labels.length]].map((label, i) => (
                <li key={i} className={ov.display}>
                  {label}
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className={styles.result} role="status">
          {run ? (
            <>
              <span className={`${ov.label} ${styles.who}`}>
                {run.memberColor && <i className={board.dot} style={{ background: run.memberColor }} aria-hidden="true" />} {run.memberName}
                {run.trigger.kind === "SIGNATURE" && <span className={ov.muted}> · {run.trigger.signatureName}</span>}
              </span>
              {shown ? (
                <strong key="hit" className={`${ov.enter} ${ov.display} ${styles.effect}`} data-motion="POP">
                  {run.kind === "TEXT" ? run.label : spinEffect(run)}
                </strong>
              ) : (
                <span className={ov.muted}>돌리는 중…</span>
              )}
            </>
          ) : (
            <span className={ov.muted}>시그니처를 기다리는 중</span>
          )}
        </p>
      </div>
    </OverlayThemeRoot>
  );
}

/** 스핀머신 BJ별 집계 overlay (`?spintally`): how many times each member got each 문구 result (nothing until the first). */
export function SpinTallyOverlay({ spin, reloadSeq, theme }: { spin: SpinLive | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!spin || !spin.tally.rows.length) return null;
  const { columns, rows } = spin.tally;
  const count = (n: number) => <span className={n === 0 ? board.sigZero : ov.display}>{formatNumber(n)}</span>;
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <div className={`${ov.card} ${board.board} ${board.sigCount}`}>
        <h1 className={`${ov.label} ${board.title}`}>{spin.settings.title || SPIN_TITLE_DEFAULT} 집계</h1>
        <table className={board.sigTable}>
          <thead>
            <tr>
              <th scope="col" aria-label="멤버" />
              {columns.map((c) => (
                <th key={c} scope="col">
                  <span className={`${ov.muted} ${board.sigHead}`}>{c}</span>
                </th>
              ))}
              {columns.length > 1 && (
                <th scope="col">
                  <span className={`${ov.muted} ${board.sigHead}`}>합계</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId}>
                <th scope="row" className={`${ov.label} ${board.name}`}>
                  {r.color && <i className={board.dot} style={{ background: r.color }} aria-hidden="true" />} {r.name}
                </th>
                {r.counts.map((n, i) => (
                  <td key={columns[i]}>{count(n)}</td>
                ))}
                {columns.length > 1 && <td>{count(r.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OverlayThemeRoot>
  );
}
