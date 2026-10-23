"use client";

import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { JUPJUP_TITLE_DEFAULT, type JupjupLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

/** Stack items the OBS card lists (the rest show as "+N"). */
const STACK_ON_SCREEN = 6;

/**
 * 줍줍 overlay (`?jupjup`): the stack waiting to be taken (oldest first), then each take as it plays — who took whose
 * 시그니처 and the points. With an empty stack it waits for the 지정 BJ (대기 중에도 보이기), or the page stays empty.
 */
export function JupjupOverlay({ jupjup, serverNow, reloadSeq, theme }: { jupjup: JupjupLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!jupjup || now === null) return null;
  const run = currentRun(jupjup.runs, "JUPJUP", now);
  if (!run && !jupjup.stackCount && !jupjup.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const owners = jupjup.ownerNames.join(" · ") || "지정 BJ";
  return (
    <GameCard
      theme={theme}
      title={jupjup.settings.title || JUPJUP_TITLE_DEFAULT}
      waiting={jupjup.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run ? signedPoints(run.points) : "", sub: run?.label ?? "" }}
      idle={jupjup.stackCount ? `대기 ${formatNumber(jupjup.stackCount)}건 — 같은 금액 시그를 기다리는 중` : `${owners}의 시그를 기다리는 중`}
      playing="줍줍!"
    >
      {run ? (
        <div className={styles.jjTake} data-hit={shown || undefined}>
          <span key={run.id} className={`${ov.display} ${styles.jjBurst}`}>
            줍줍!
          </span>
          <span className={ov.muted}>
            {run.from ? `${run.from.memberName} ${formatNumber(run.from.amount)} FN` : "스택"} → {run.memberName}
          </span>
        </div>
      ) : jupjup.stack.length ? (
        <ul className={styles.jjStack}>
          {jupjup.stack.slice(0, STACK_ON_SCREEN).map((x) => (
            <li key={x.id} className={ov.chip}>
              {x.memberColor && <i className={board.dot} style={{ background: x.memberColor }} aria-hidden="true" />}
              {x.signatureName} <b className={ov.display}>{formatNumber(x.amount)}</b>
            </li>
          ))}
          {jupjup.stackCount > STACK_ON_SCREEN && <li className={ov.chip}>+{formatNumber(jupjup.stackCount - STACK_ON_SCREEN)}</li>}
        </ul>
      ) : (
        <div className={styles.jjTake}>
          <span className={`${styles.sigUnknown} ${styles.jjEmpty}`}>🎁</span>
        </div>
      )}
    </GameCard>
  );
}
