import { rumbleRing } from "./rumbleTypes";

/**
 * 로얄 럼블 (조작형) battle — code-first, StreamDonate "로얄 럼블 (조작형)" 참고 (P2). Pure and deterministic, so the server
 * owns it and tests can replay it: fixed ticks on a round arena (radius 1). Each fighter moves by its player's joystick and
 * attacks around itself (cooldown); hits take HP and push the target away. Outside the ring (it closes in, and squeezes at
 * the end like the auto 로얄 럼블) HP drains. Last one standing wins; at the time limit the most HP (then 처치) wins.
 */

export const LIVE_TICK_MS = 50;
export const LIVE_HP = 100;
/** Arena units per second. */
export const LIVE_SPEED = 0.35;
export const LIVE_ATTACK_RANGE = 0.16;
export const LIVE_ATTACK_DAMAGE = 20;
export const LIVE_ATTACK_COOLDOWN_MS = 800;
export const LIVE_KNOCKBACK = 0.07;
/** HP per second outside the ring. */
export const LIVE_RING_DPS = 20;
/** How far apart fighters start (radius of the starting circle). */
const SPAWN_RADIUS = 0.6;

export type LiveOut = { at: number; by: string | "RING" };
export type SimPlayer = {
  id: string;
  x: number;
  y: number;
  /** Facing (unit vector), for drawing. */
  fx: number;
  fy: number;
  hp: number;
  kills: number;
  out: LiveOut | null;
  lastAttack: number;
  input: { dx: number; dy: number };
  /** An attack asked for since the last tick. */
  attack: boolean;
};
export type SimEvent = { t: number; kind: "HIT" | "KO" | "RING"; by: string | null; target: string };
export type LiveSim = { t: number; players: SimPlayer[]; events: SimEvent[]; done: boolean };
export type LiveRules = { battleSec: number; ringShrink: boolean };

const EVENTS_MAX = 30;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Fighters spread evenly on a circle, facing the middle. */
export function createSim(ids: string[]): LiveSim {
  const n = ids.length;
  return {
    t: 0,
    done: false,
    events: [],
    players: ids.map((id, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      return { id, x: r3(SPAWN_RADIUS * Math.cos(a)), y: r3(SPAWN_RADIUS * Math.sin(a)), fx: r3(-Math.cos(a)), fy: r3(-Math.sin(a)), hp: LIVE_HP, kills: 0, out: null, lastAttack: -Infinity, input: { dx: 0, dy: 0 }, attack: false };
    })
  };
}

/** A joystick reading as a direction of length ≤ 1 (anything not a finite number is "stand still"). */
export function joystick(dx: unknown, dy: unknown) {
  const x = typeof dx === "number" && Number.isFinite(dx) ? dx : 0;
  const y = typeof dy === "number" && Number.isFinite(dy) ? dy : 0;
  const len = Math.hypot(x, y);
  return len > 1 ? { dx: x / len, dy: y / len } : { dx: x, dy: y };
}

export const ringAt = (sim: LiveSim, rules: LiveRules) => rumbleRing(Math.min(sim.t / 1000, rules.battleSec), rules.battleSec, rules.ringShrink, true);
const alive = (sim: LiveSim) => sim.players.filter((p) => !p.out);

/** Keeps a point inside the arena (radius 1). */
function inside(p: SimPlayer) {
  const d = Math.hypot(p.x, p.y);
  if (d > 1) {
    p.x /= d;
    p.y /= d;
  }
}

/** One tick: move, attack, ring damage, then whether it is over. */
export function step(sim: LiveSim, rules: LiveRules, dtMs = LIVE_TICK_MS): LiveSim {
  if (sim.done) return sim;
  sim.t += dtMs;
  const dt = dtMs / 1000;
  const event = (e: Omit<SimEvent, "t">) => {
    sim.events.push({ t: sim.t, ...e });
    if (sim.events.length > EVENTS_MAX) sim.events.splice(0, sim.events.length - EVENTS_MAX);
  };
  const ko = (target: SimPlayer, by: SimPlayer | null) => {
    target.hp = 0;
    target.out = { at: sim.t, by: by ? by.id : "RING" };
    if (by) by.kills += 1;
    event({ kind: by ? "KO" : "RING", by: by?.id ?? null, target: target.id });
  };

  for (const p of alive(sim)) {
    const { dx, dy } = p.input;
    if (dx || dy) {
      p.x += dx * LIVE_SPEED * dt;
      p.y += dy * LIVE_SPEED * dt;
      const len = Math.hypot(dx, dy);
      p.fx = r3(dx / len);
      p.fy = r3(dy / len);
      inside(p);
    }
  }
  for (const p of alive(sim)) {
    if (!p.attack || p.out) continue;
    p.attack = false;
    if (sim.t - p.lastAttack < LIVE_ATTACK_COOLDOWN_MS) continue;
    p.lastAttack = sim.t;
    for (const q of alive(sim)) {
      if (q === p) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > LIVE_ATTACK_RANGE) continue;
      q.hp = Math.max(0, q.hp - LIVE_ATTACK_DAMAGE);
      const ux = d > 0 ? (q.x - p.x) / d : p.fx;
      const uy = d > 0 ? (q.y - p.y) / d : p.fy;
      q.x += ux * LIVE_KNOCKBACK;
      q.y += uy * LIVE_KNOCKBACK;
      inside(q);
      if (q.hp <= 0) ko(q, p);
      else event({ kind: "HIT", by: p.id, target: q.id });
    }
  }
  const ring = ringAt(sim, rules);
  for (const p of alive(sim)) {
    if (Math.hypot(p.x, p.y) <= ring) continue;
    p.hp = Math.max(0, Math.round((p.hp - LIVE_RING_DPS * dt) * 100) / 100);
    if (p.hp <= 0) ko(p, null);
  }
  if (alive(sim).length <= 1 || sim.t >= rules.battleSec * 1000) sim.done = true;
  return sim;
}

export type LiveStanding = { id: string; rank: number; hp: number; kills: number; out: LiveOut | null };
/**
 * The table: standing fighters first (more HP, then more 처치), then the knocked out, the last out first (then more 처치).
 * Ties keep the joining order. The first is the winner.
 */
export function standings(sim: LiveSim): LiveStanding[] {
  const order = new Map(sim.players.map((p, i) => [p.id, i]));
  const sorted = [...sim.players].sort((a, b) => {
    if (!a.out !== !b.out) return a.out ? 1 : -1;
    if (!a.out && !b.out) return b.hp - a.hp || b.kills - a.kills || order.get(a.id)! - order.get(b.id)!;
    return b.out!.at - a.out!.at || b.kills - a.kills || order.get(a.id)! - order.get(b.id)!;
  });
  return sorted.map((p, i) => ({ id: p.id, rank: i + 1, hp: Math.ceil(p.hp), kills: p.kills, out: p.out }));
}
