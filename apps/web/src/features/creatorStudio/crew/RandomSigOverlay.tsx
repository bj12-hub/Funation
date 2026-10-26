"use client";

import { useEffect, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { RANDOM_SIG_TITLE_DEFAULT, type GameRunView, type RandomSigLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

type Pool = RandomSigLive["pool"];

/**
 * The line under the drawn signature: 기본 모드 "×2 · +10,000점" / "×1 · 발동 금액보다 낮은 시그", 앞자리 배수
 * "앞자리 ×3 · +10,000점", 랜덤 결과 모드 "시그 가격 기준 · −2,000점".
 */
export function randomSigLine(r: GameRunView) {
  if (r.kind === "ADD") return `시그 가격 기준 · ${signedPoints(r.points)}`;
  if (r.digit) return `앞자리 ×${r.value} · ${signedPoints(r.points)}`;
  return r.value > 1 ? `×${r.value} · ${signedPoints(r.points)}` : "×1 · 발동 금액보다 낮은 시그";
}

/**
 * While rolling, flips through the signature images in the run's range (all of `pool` without one) — looks only, the server
 * drew the signature; then the drawn one. Shared by 랜덤시그 and 메들리.
 */
export function SigStage({ pool, run, rolling }: { pool: Pool; run: GameRunView; rolling: boolean }) {
  const [i, setI] = useState(0);
  const [min, max] = run.range ?? [0, Infinity];
  const inRange = pool.filter((s) => s.price >= min && s.price <= max);
  const roll = inRange.length ? inRange : pool;
  useEffect(() => {
    if (!rolling) return;
    const tick = setInterval(() => setI((n) => n + 1), 90);
    return () => clearInterval(tick);
  }, [rolling]);
  const shown = rolling ? roll[i % Math.max(1, roll.length)] : pool.find((s) => s.id === run.itemId);
  return (
    <div className={styles.sigStage} data-rolling={rolling || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock) */}
      {shown ? <img src={shown.imageUrl} alt="" /> : <span className={styles.sigUnknown}>?</span>}
    </div>
  );
}

/**
 * 랜덤시그 overlay (`?randomsig`): queued runs play one after another — the tier's signature images roll, the drawn
 * signature shows, then the points. Between runs a "?" card rests (대기 중에도 보이기), or the page stays empty.
 */
export function RandomSigOverlay({ randomSig, serverNow, reloadSeq, theme }: { randomSig: RandomSigLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!randomSig || now === null) return null;
  const run = currentRun(randomSig.runs, "RANDOM_SIG", now);
  if (!run && !randomSig.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  return (
    <GameCard
      theme={theme}
      title={randomSig.settings.title || RANDOM_SIG_TITLE_DEFAULT}
      waiting={randomSig.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run ? randomSigLine(run) : "" }}
      idle="발동 금액 후원을 기다리는 중"
      playing="뽑는 중…"
    >
      {run ? (
        <SigStage key={run.id} pool={randomSig.pool} run={run} rolling={!shown} />
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>?</span>
        </div>
      )}
    </GameCard>
  );
}
