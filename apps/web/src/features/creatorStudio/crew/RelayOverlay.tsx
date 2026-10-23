"use client";

import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { RELAY_TITLE_DEFAULT, type RelayLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * 기여도 릴레이 overlay (`?relay`): the 배수 waiting for the next 시그니처 후원 (from the 트리거 BJ's last one), then each relay
 * as it plays — the 배수 passes to the member and the points show. With nothing waiting it rests at ×1 (대기 중에도 보이기),
 * or the page stays empty.
 */
export function RelayOverlay({ relay, serverNow, reloadSeq, theme }: { relay: RelayLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!relay || now === null) return null;
  const run = currentRun(relay.runs, "RELAY", now);
  const pending = relay.pending;
  if (!run && !pending && !relay.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const trigger = relay.triggerName ?? "트리거 BJ";
  return (
    <GameCard
      theme={theme}
      title={relay.settings.title || RELAY_TITLE_DEFAULT}
      waiting={relay.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run ? signedPoints(run.points) : "", sub: run?.from ? `${run.from.memberName} ${formatNumber(run.from.amount)} FN 시그에서 이어받음` : "" }}
      idle={pending ? "다음 시그니처 후원에 적용돼요" : `${trigger}의 시그를 기다리는 중`}
      playing="릴레이!"
    >
      {run ? (
        <div className={styles.relayStage} data-hit={shown || undefined}>
          <span key={run.id} className={`${ov.display} ${styles.relayBadge} ${styles.relayPass}`}>
            ×{run.value}
          </span>
          <span className={ov.muted}>
            {run.from?.memberName ?? trigger} → {run.memberName}
          </span>
        </div>
      ) : (
        <div className={styles.relayStage} data-pending={pending ? "" : undefined}>
          <span className={`${ov.display} ${styles.relayBadge}`}>×{pending ? pending.multiplier : 1}</span>
          <span className={ov.muted}>{pending ? `다음 시그 대기 · ${trigger} ${formatNumber(pending.amount)} FN` : "대기 중인 배수 없음"}</span>
        </div>
      )}
    </GameCard>
  );
}
