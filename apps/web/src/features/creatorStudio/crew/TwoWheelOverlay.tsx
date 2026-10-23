"use client";

import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { GAME_TIMING, TWO_WHEEL_PLUS_MAX, TWO_WHEEL_TIMES_MAX, TWO_WHEEL_TITLE_DEFAULT, type TwoWheelLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, IdleStrip, ReelStrip, currentRun, gameEffect } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

const OPS = ["+", "×"];
const numbers = (max: number) => Array.from({ length: max }, (_, i) => String(i + 1));
/** The operator reel stops first, the number reel at the end of the play time. */
const OP_SHARE = 0.55;

/**
 * 투휠 게임 overlay (`?twowheel`): queued runs play one after another — the operator reel (+ / ×) stops, then the number
 * reel, then the result shows. Between runs both reels rest (대기 중에도 보이기), or the page stays empty.
 */
export function TwoWheelOverlay({ wheel, serverNow, reloadSeq, theme }: { wheel: TwoWheelLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!wheel || now === null) return null;
  const run = currentRun(wheel.runs, "TWO_WHEEL", now);
  if (!run && !wheel.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const play = GAME_TIMING.TWO_WHEEL.playSec;
  const result = run?.wheel;
  const nums = numbers(result?.op === "MULTIPLY" ? TWO_WHEEL_TIMES_MAX : TWO_WHEEL_PLUS_MAX);
  return (
    <GameCard
      theme={theme}
      title={wheel.settings.title || TWO_WHEEL_TITLE_DEFAULT}
      waiting={wheel.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run ? gameEffect(run) : "" }}
      idle="시그니처를 기다리는 중"
      playing="돌리는 중…"
    >
      <div className={styles.wheels}>
        <div className={styles.window} data-hit={shown || undefined}>
          {run && result ? (
            <ReelStrip key={`${run.id}-op`} items={OPS} result={result.op === "ADD" ? "+" : "×"} showAt={run.showAt} sec={play * OP_SHARE} now={now} />
          ) : (
            <IdleStrip items={OPS} />
          )}
        </div>
        <div className={styles.window} data-hit={shown || undefined}>
          {run && result ? <ReelStrip key={`${run.id}-n`} items={nums} result={String(result.n)} showAt={run.showAt} sec={play} now={now} /> : <IdleStrip items={nums} />}
        </div>
      </div>
    </GameCard>
  );
}
