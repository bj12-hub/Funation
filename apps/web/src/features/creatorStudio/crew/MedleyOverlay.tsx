"use client";

import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { MEDLEY_TITLE_DEFAULT, type MedleyLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun } from "./GameOverlayParts";
import { SigStage } from "./RandomSigOverlay";
import styles from "./gameOverlay.module.css";

/**
 * 시그니처 메들리 overlay (`?medley`): queued medleys play one after another — the registered signatures' images roll, then
 * the drawn one shows. Between them a "?" card rests (대기 중에도 보이기), or the page stays empty.
 */
export function MedleyOverlay({ medley, serverNow, reloadSeq, theme }: { medley: MedleyLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!medley || now === null) return null;
  const run = currentRun(medley.runs, "MEDLEY", now);
  if (!run && !medley.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const trigger = medley.settings.trigger;
  return (
    <GameCard
      theme={theme}
      title={medley.settings.title || MEDLEY_TITLE_DEFAULT}
      waiting={medley.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run?.trigger.kind === "MANUAL" ? "메들리" : "" }}
      idle={trigger ? `${formatNumber(trigger)} FN 메들리 후원을 기다리는 중` : "메들리 후원을 기다리는 중"}
      playing="뽑는 중…"
    >
      {run ? (
        <SigStage key={run.id} pool={medley.pool} run={run} rolling={!shown} />
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>?</span>
        </div>
      )}
    </GameCard>
  );
}
