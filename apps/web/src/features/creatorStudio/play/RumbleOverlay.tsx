"use client";

import type { CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import {
  RUMBLE_SHRINK_AT,
  RUMBLE_SUDDEN_AT,
  rumbleBots,
  rumbleRing,
  rumbleStandings,
  type RumbleBattle,
  type RumbleFighter,
  type RumbleOverlayView
} from "@/services/play/rumbleTypes";
import { useOverlayPage } from "../crew/CrewScoreOverlay";
import { PLAY_COLORS, playHash, useFrameClock } from "./playOverlayClock";
import styles from "./rumbleOverlay.module.css";

/** Names show under the fighters up to this many (initials past it). */
const LABELS_MAX = 16;
const SHOWN_NAMES = 30;
const BOT_COLOR = "#94a3b8";
/** Seconds a fighter rushes at the one it knocks out, and backs off after. */
const RUSH = 0.7;
const BACK = 0.5;
/** Seconds a ring-out takes, and a knockout's 💥 stays. */
const PUSH = 0.9;
const BURST = 0.7;

type Pos = { x: number; y: number };
const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: Pos, b: Pos, s: number): Pos => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });

/** Where a fighter roams `t` seconds in (from the arena's center, 1 = its edge), always inside the ring. */
function roam(seed: number, t: number, ring: number): Pos {
  const a = (seed % 628) / 100;
  const b = ((seed >>> 4) % 628) / 100;
  const w1 = 0.3 + (seed % 7) * 0.05;
  const w2 = 0.45 + ((seed >>> 3) % 5) * 0.07;
  const s = Math.max(0, t);
  let x = 0.62 * Math.sin(s * w1 + a) + 0.38 * Math.sin(s * w2 * 1.6 + b);
  let y = 0.62 * Math.cos(s * w1 * 0.85 + b) + 0.38 * Math.sin(s * w2 + a);
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x: x * ring * 0.82, y: y * ring * 0.82 };
}

function Battle({ battle, now }: { battle: RumbleBattle; now: number }) {
  const start = Date.parse(battle.startAt);
  const sec = (Date.parse(battle.endAt) - start) / 1000;
  const t = (now - start) / 1000;
  const done = t >= sec;
  const ringAt = (time: number) => rumbleRing(Math.min(sec, Math.max(0, time)), sec, battle.ringShrink, battle.suddenDeath);
  const ring = ringAt(t);
  const byId = new Map(battle.fighters.map((f) => [f.id, f]));
  const outAt = new Map(battle.knockouts.map((k) => [k.victimId, k]));
  const labels = battle.fighters.length <= LABELS_MAX;

  /** Where `f` is at `time`: roaming, rushing at the one it knocks out, or pushed out of the ring. */
  const place = (f: RumbleFighter, time: number): Pos => {
    let p = roam(playHash(f.id), time, ringAt(time));
    const hit = battle.knockouts.filter((k) => k.killerId === f.id && time > k.at - RUSH && time < k.at + BACK).at(-1);
    if (hit) {
      const s = time < hit.at ? ease(clamp01((time - (hit.at - RUSH)) / RUSH)) : 1 - clamp01((time - hit.at) / BACK);
      p = lerp(p, roam(playHash(hit.victimId), time, ringAt(time)), s * 0.92);
    }
    const out = outAt.get(f.id);
    if (out && !out.killerId && time > out.at - PUSH) {
      const len = Math.hypot(p.x, p.y) || 1;
      const edge = { x: (p.x / len) * ringAt(time) * 1.08, y: (p.y / len) * ringAt(time) * 1.08 };
      p = lerp(p, edge, ease(clamp01((time - (out.at - PUSH)) / PUSH)));
    }
    return p;
  };
  const at = (p: Pos) => ({ "--x": (p.x + 1) / 2, "--y": (p.y + 1) / 2 }) as CSSProperties;

  const gone = battle.knockouts.filter((k) => k.at <= t);
  const standing = battle.fighters.filter((f) => (outAt.get(f.id)?.at ?? Infinity) > t);
  const bursts = gone.filter((k) => t - k.at < BURST);
  const winner = rumbleStandings(battle)[0];
  const banner =
    t < 0 ? null : !done && battle.suddenDeath && t >= sec * RUMBLE_SUDDEN_AT ? "서든데스!" : battle.ringShrink && RUMBLE_SHRINK_AT.some((p) => t >= sec * p && t < sec * p + 2) ? "링 축소!" : null;
  return (
    <>
      <p className={`${ov.muted} ${styles.alive}`}>
        생존 <strong className={ov.display}>{standing.length}</strong> / {battle.fighters.length}
      </p>
      <div className={styles.arena}>
        <div className={styles.ring} data-sudden={banner === "서든데스!" || undefined} style={{ "--r": ring } as CSSProperties} />
        {standing.map((f) => {
          const seed = playHash(f.id);
          return (
            <span
              key={f.id}
              className={styles.fighter}
              data-win={(done && f.id === battle.winnerId) || undefined}
              style={{ ...at(place(f, t)), "--c": f.bot ? BOT_COLOR : PLAY_COLORS[seed % PLAY_COLORS.length] } as CSSProperties}
            >
              {labels ? <i className={styles.name}>{f.name}</i> : <b>{f.name.slice(0, 1)}</b>}
            </span>
          );
        })}
        {bursts.map((k) => (
          <span key={k.victimId} className={styles.burst} style={at(place(byId.get(k.victimId)!, k.at - 0.01))} aria-hidden>
            💥
          </span>
        ))}
        {t < 0 && <strong className={`${ov.display} ${styles.countdown}`}>{Math.ceil(-t)}</strong>}
        {banner && <strong className={`${ov.display} ${styles.banner}`}>{banner}</strong>}
      </div>
      {done ? (
        <p className={styles.winner} role="status">
          <span className={ov.muted}>🏆 우승</span>
          <strong className={ov.display}>{winner.name}</strong>
          <span className={ov.muted}>처치 {winner.kills}</span>
        </p>
      ) : (
        <ol className={styles.feed} aria-label="탈락">
          {gone
            .slice(-4)
            .reverse()
            .map((k) => (
              <li key={k.victimId}>
                {k.killerId ? (
                  <>
                    ⚔️ {byId.get(k.killerId)!.name} <span className={ov.muted}>→</span> {byId.get(k.victimId)!.name}
                  </>
                ) : (
                  <>
                    🌀 {byId.get(k.victimId)!.name} <span className={ov.muted}>링 밖</span>
                  </>
                )}
              </li>
            ))}
          {t >= 0 && gone.length === 0 && <li className={ov.muted}>싸우는 중…</li>}
        </ol>
      )}
    </>
  );
}

/**
 * 로얄 럼블 overlay (`/overlay/play/[key]?rumble`): while 모집 중, how to join and who joined (and how many 봇 come along);
 * then the battle — a 3-second countdown, the fighters roaming a round arena, each knockout as the server decided it (the
 * attacker rushes in, or the ring pushes them out), 링 축소 · 서든데스, the latest knockouts — and the winner. Nothing
 * without a round (or with 리모컨 OFF).
 */
export function RumbleOverlay({ data }: { data: RumbleOverlayView }) {
  useOverlayPage(data.reloadSeq);
  const round = data.round;
  const now = useFrameClock(data.serverNow, round?.status === "FIGHTING");
  if (!data.on || !round) return null;
  const bots = rumbleBots(round.entrants.length, round.fillTo);
  return (
    <OverlayThemeRoot theme={data.theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.card}`}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {data.title}
          <span className={`${ov.chip} ${styles.chip}`}>{round.no}회차</span>
        </h1>
        {round.battle ? (
          <Battle battle={round.battle} now={now} />
        ) : (
          <>
            <p className={styles.join}>
              채팅에 <strong className={ov.display}>{round.keyword}</strong> 입력하면 참가!
            </p>
            <p className={ov.muted}>
              참가 {round.entrants.length} / {round.maxPlayers}명{bots > 0 && ` · 봇 ${bots}명 함께`}
            </p>
            <ul className={styles.names}>
              {round.entrants.slice(-SHOWN_NAMES).map((e) => (
                <li key={e.id} className={ov.chip} style={{ "--c": PLAY_COLORS[playHash(e.id) % PLAY_COLORS.length] } as CSSProperties}>
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
