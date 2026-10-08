"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adjustTimer, controlCredits, controlTimer } from "@/services/creator/broadcastTools";
import { TIMER_ADJUST_STEPS, type ToolResult, type ToolStates } from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import { clock, timerSeconds } from "../widgets/timerMath";
import remote from "./remote.module.css";

export const signedSec = (s: number) => `${s > 0 ? "+" : "−"}${Math.abs(s)}초`;

/**
 * 리모컨 "방송 도구" card — code-first. Timer start/pause/reset + 퀵 조정, 엔딩 크레딧 시작/중지.
 * Content (문구 · 시간 설정) is edited on /creator/widgets/tools.
 */
export function ToolsRemote({
  tools,
  pending,
  run
}: {
  tools: Pick<ToolStates, "timer" | "credits">;
  pending: boolean;
  run: (action: () => Promise<ToolResult>, ok?: string) => void;
}) {
  const t = tools.timer;
  const running = Boolean(t.startedAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [running, t]);
  const rolling = Boolean(tools.credits.rollingSince);

  return (
    <section className={styles.card} aria-labelledby="tools-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="tools-remote">
          방송 도구
        </h2>
        <Link href="/creator/widgets/tools" className={styles.ghost}>
          문구 · 시간 설정
        </Link>
      </div>
      <div className={remote.columns}>
        <div className={remote.toolBox}>
          <span className={styles.muted}>타이머 · {t.mode === "COUNTDOWN" ? "카운트다운" : "스톱워치"}</span>
          <span className={styles.clock}>
            {running && <span className={styles.liveDot} aria-hidden="true" />}
            {now === null ? "--:--" : clock(timerSeconds(t, now))}
          </span>
          <div className={remote.buttons}>
            {running ? (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => controlTimer("PAUSE"))}>
                일시정지
              </button>
            ) : (
              <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => controlTimer("START"))}>
                {t.elapsedBeforeSec > 0 ? "재개" : "시작"}
              </button>
            )}
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => controlTimer("RESET"))}>
              초기화
            </button>
          </div>
          <div className={remote.buttons} role="group" aria-label="타이머 퀵 조정">
            {TIMER_ADJUST_STEPS.map((s) => (
              <button key={s} type="button" className={styles.chipOff} disabled={pending} onClick={() => run(() => adjustTimer(s))}>
                {signedSec(s)}
              </button>
            ))}
          </div>
        </div>
        <div className={remote.toolBox}>
          <span className={styles.muted}>엔딩 크레딧</span>
          <strong>{rolling ? "방송 화면에 흐르는 중" : "대기 중"}</strong>
          <div className={remote.buttons}>
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => controlCredits("START"), rolling ? "처음부터 다시 흘려요." : "엔딩 크레딧을 시작했어요.")}>
              {rolling ? "처음부터" : "🎬 크레딧 시작"}
            </button>
            <button type="button" className={styles.ghost} disabled={pending || !rolling} onClick={() => run(() => controlCredits("STOP"), "엔딩 크레딧을 멈췄어요.")}>
              크레딧 중지
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
