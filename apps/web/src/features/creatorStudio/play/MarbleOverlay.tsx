"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { MARBLE_SKILL_LABEL, marbleProgress, type MarbleMap, type MarbleOverlayView, type MarbleRace, type MarbleRound } from "@/services/play/marbleTypes";
import { useOverlayPage } from "../crew/CrewScoreOverlay";
import styles from "./marbleOverlay.module.css";

const COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#84cc16", "#06b6d4"];
/** A stable number per entrant (its color, lane and wobble). */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Names show beside the marbles up to this many entrants (initials past it). */
const LABELS_MAX = 12;
const SHOWN_NAMES = 30;

/** Across the course (0 ~ 1) at `p` of the way down, by the map's shape. */
function marbleX(map: MarbleMap, p: number, seed: number) {
  const lane = 0.12 + ((seed % 1000) / 1000) * 0.76;
  const phase = (seed % 360) * (Math.PI / 180);
  const x =
    map === "PINS"
      ? lane + 0.05 * Math.sin(p * 30 + phase)
      : map === "ZIGZAG"
        ? 0.5 + 0.36 * (2 * Math.abs(((p * 4 + lane) % 2) - 1) - 1)
        : map === "SPIRAL"
          ? 0.5 + 0.36 * Math.cos(p * Math.PI * 6 + phase)
          : lane + (Math.floor(p * 8) % 2 ? 0.1 : -0.1);
  return Math.min(0.95, Math.max(0.05, x));
}

/** The browser clock corrected to the server's, read every frame while racing. */
function useFrameClock(serverNow: string, running: boolean) {
  const [skew] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    if (!running) {
      setNow(Date.now() + skew);
      const tick = setInterval(() => setNow(Date.now() + skew), 1000);
      return () => clearInterval(tick);
    }
    let frame = requestAnimationFrame(function step() {
      setNow(Date.now() + skew);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, skew]);
  return now;
}

/** When each entrant is in, by finishing place: the first at 70% of the race, the last at its end. */
const finishSec = (race: MarbleRace, raceSec: number) => {
  const n = race.order.length;
  return new Map(race.order.map((id, i) => [id, raceSec * (0.7 + (n > 1 ? (0.3 * i) / (n - 1) : 0.3))]));
};

function Race({ round, race, now }: { round: MarbleRound; race: MarbleRace; now: number }) {
  const start = Date.parse(race.startAt);
  const raceSec = (Date.parse(race.finishAt) - start) / 1000;
  const t = (now - start) / 1000;
  const finish = finishSec(race, raceSec);
  const done = now >= Date.parse(race.finishAt);
  const labels = round.entrants.length <= LABELS_MAX;
  const inNow = race.order.filter((id) => t >= finish.get(id)!);
  const name = (id: string) => round.entrants.find((e) => e.id === id)?.name ?? "";
  const winner = name(race.winnerId);
  return (
    <>
      <div className={styles.track} data-map={race.map}>
        {round.entrants.map((e) => {
          const seed = hash(e.id);
          const skill = race.skills.find((s) => s.entrantId === e.id) ?? null;
          const p = marbleProgress(t, finish.get(e.id)!, seed, skill);
          const showSkill = skill && t > 0 && Math.abs(t / finish.get(e.id)! - skill.at) < 0.06;
          return (
            <span
              key={e.id}
              className={styles.marble}
              data-win={(done && e.id === race.winnerId) || undefined}
              style={{ "--x": marbleX(race.map, p, seed), "--y": p, "--marble": COLORS[seed % COLORS.length] } as CSSProperties}
            >
              {labels ? <i className={styles.name}>{e.name}</i> : <b>{e.name.slice(0, 1)}</b>}
              {showSkill && <em className={styles.skill}>{MARBLE_SKILL_LABEL[skill.kind]}</em>}
            </span>
          );
        })}
        {t < 0 && <strong className={`${ov.display} ${styles.countdown}`}>{Math.ceil(-t)}</strong>}
      </div>
      {done ? (
        <p className={styles.winner} role="status">
          <span className={ov.muted}>{round.rule} 당첨</span>
          <strong className={ov.display}>{winner}</strong>
        </p>
      ) : (
        <ol className={styles.finished} aria-label="들어온 순서">
          {inNow.slice(0, 5).map((id, i) => (
            <li key={id}>
              <span className={ov.muted}>{i + 1}</span> {name(id)}
            </li>
          ))}
          {t >= 0 && inNow.length === 0 && <li className={ov.muted}>달리는 중…</li>}
        </ol>
      )}
    </>
  );
}

/**
 * 마블 룰렛 overlay (`/overlay/play/[key]?marble`): while 모집 중, how to join and who joined; then the race — a 3-second
 * countdown, the marbles rolling down the map to the server's order (스킬 flash by them), the order as they come in — and
 * the winner by the 당첨 rule. Nothing without a round (or with 리모컨 OFF).
 */
export function MarbleOverlay({ data }: { data: MarbleOverlayView }) {
  useOverlayPage(data.reloadSeq);
  const round = data.round;
  const racing = round?.status === "RACING";
  const now = useFrameClock(data.serverNow, racing);
  if (!data.on || !round) return null;
  return (
    <OverlayThemeRoot theme={data.theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.card}`}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {data.title}
          <span className={`${ov.chip} ${styles.chip}`}>
            {round.no}회차 · {round.rule} 당첨
          </span>
        </h1>
        {round.race ? (
          <Race round={round} race={round.race} now={now} />
        ) : (
          <>
            <p className={styles.join}>
              {round.mode === "CHAT" ? (
                <>
                  채팅에 <strong className={ov.display}>{round.keyword}</strong> 입력하면 참가!
                </>
              ) : (
                "초대 링크로 참가 중"
              )}
            </p>
            <p className={ov.muted}>
              참가 {round.entrants.length} / {round.maxPlayers}명
            </p>
            <ul className={styles.names}>
              {round.entrants.slice(-SHOWN_NAMES).map((e) => (
                <li key={e.id} className={ov.chip} style={{ "--marble": COLORS[hash(e.id) % COLORS.length] } as CSSProperties}>
                  {e.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </OverlayThemeRoot>
  );
}
