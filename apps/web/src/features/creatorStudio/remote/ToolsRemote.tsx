"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
  const timer = tools.timer;
  const running = Boolean(timer.startedAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [running, timer]);
  const rolling = Boolean(tools.credits.rollingSince);

  return (
    <section className={styles.card} aria-labelledby="tools-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="tools-remote">
          {t("studioRemote.toolsTitle")}
        </h2>
        <Link href="/creator/widgets/tools" className={styles.ghost}>
          {t("studioRemote.toolsSettings")}
        </Link>
      </div>
      <div className={remote.columns}>
        <div className={remote.toolBox}>
          <span className={styles.muted}>{t("studioRemote.timerLabel", { mode: t(timer.mode === "COUNTDOWN" ? "studioRemote.countdown" : "studioRemote.stopwatch") })}</span>
          <span className={styles.clock}>
            {running && <span className={styles.liveDot} aria-hidden="true" />}
            {now === null ? "--:--" : clock(timerSeconds(timer, now))}
          </span>
          <div className={remote.buttons}>
            {running ? (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => controlTimer("PAUSE"))}>
                {t("studioRemote.timerPause")}
              </button>
            ) : (
              <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => controlTimer("START"))}>
                {timer.elapsedBeforeSec > 0 ? t("studioRemote.timerResume") : t("studioRemote.timerStart")}
              </button>
            )}
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => controlTimer("RESET"))}>
              {t("studioRemote.timerReset")}
            </button>
          </div>
          <div className={remote.buttons} role="group" aria-label={t("studioRemote.timerQuick")}>
            {TIMER_ADJUST_STEPS.map((s) => (
              <button key={s} type="button" className={styles.chipOff} disabled={pending} onClick={() => run(() => adjustTimer(s))}>
                {t("studioRemote.signedSec", { sign: s > 0 ? "+" : "−", sec: Math.abs(s) })}
              </button>
            ))}
          </div>
        </div>
        <div className={remote.toolBox}>
          <span className={styles.muted}>{t("studioRemote.credits")}</span>
          <strong>{rolling ? t("studioRemote.creditsRolling") : t("studioRemote.creditsIdle")}</strong>
          <div className={remote.buttons}>
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => controlCredits("START"), rolling ? t("studioRemote.creditsRestarted") : t("studioRemote.creditsStarted"))}>
              {rolling ? t("studioRemote.creditsFromStart") : t("studioRemote.creditsStart")}
            </button>
            <button type="button" className={styles.ghost} disabled={pending || !rolling} onClick={() => run(() => controlCredits("STOP"), t("studioRemote.creditsStopped"))}>
              {t("studioRemote.creditsStop")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
