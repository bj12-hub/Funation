import { describe, expect, it } from "vitest";
import {
  LIVE_ATTACK_COOLDOWN_MS,
  LIVE_ATTACK_DAMAGE,
  LIVE_HP,
  LIVE_KNOCKBACK,
  LIVE_TICK_MS,
  createSim,
  joystick,
  ringAt,
  standings,
  step,
  type LiveRules,
  type LiveSim
} from "./rumbleLiveSim";

/** 로얄 럼블 (조작형) 배틀 (2026-10-24) — the deterministic simulation. */
const rules: LiveRules = { battleSec: 60, ringShrink: true };
const run = (sim: LiveSim, ms: number, r = rules) => {
  for (let t = 0; t < ms; t += LIVE_TICK_MS) step(sim, r);
  return sim;
};
const two = () => {
  const sim = createSim(["a", "b"]);
  // Put them face to face in the middle.
  Object.assign(sim.players[0], { x: -0.05, y: 0 });
  Object.assign(sim.players[1], { x: 0.05, y: 0 });
  return sim;
};

describe("로얄 럼블 (조작형) 배틀", () => {
  it("spreads fighters on a circle facing the middle, and reads the joystick as at most length 1", () => {
    const sim = createSim(["a", "b", "c", "d"]);
    expect(sim.players.map((p) => [p.x, p.y])).toEqual([
      [0, -0.6],
      [0.6, 0],
      [0, 0.6],
      [-0.6, 0]
    ]);
    expect(sim.players[0]).toMatchObject({ fx: -0, fy: 1, hp: LIVE_HP, kills: 0, out: null });
    expect(joystick(3, 4)).toEqual({ dx: 0.6, dy: 0.8 });
    expect(joystick(0.2, -0.1)).toEqual({ dx: 0.2, dy: -0.1 });
    expect(joystick("x", Number.NaN)).toEqual({ dx: 0, dy: 0 });
  });

  it("moves by the joystick at a fixed speed and never leaves the arena", () => {
    const sim = createSim(["a", "b"]);
    sim.players[0].input = { dx: 0, dy: 1 };
    run(sim, 1000);
    expect(sim.players[0].y).toBeCloseTo(-0.6 + 0.35, 2);
    expect(sim.players[0]).toMatchObject({ fx: 0, fy: 1 });
    sim.players[1].input = { dx: 1, dy: 0 };
    run(sim, 3000);
    expect(Math.hypot(sim.players[1].x, sim.players[1].y)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("hits everyone in range with a cooldown, pushes them away, and knocks out at 0 HP", () => {
    const sim = two();
    sim.players[0].attack = true;
    step(sim, rules);
    expect(sim.players[1].hp).toBe(LIVE_HP - LIVE_ATTACK_DAMAGE);
    expect(sim.players[1].x).toBeCloseTo(0.05 + LIVE_KNOCKBACK, 3);
    expect(sim.events.at(-1)).toMatchObject({ kind: "HIT", by: "a", target: "b" });
    // Within the cooldown nothing happens; an attack out of range misses.
    sim.players[0].attack = true;
    step(sim, rules);
    expect(sim.players[1].hp).toBe(LIVE_HP - LIVE_ATTACK_DAMAGE);
    run(sim, LIVE_ATTACK_COOLDOWN_MS);
    sim.players[0].attack = true;
    step(sim, rules);
    expect(sim.players[1].hp).toBe(LIVE_HP - LIVE_ATTACK_DAMAGE); // knocked out of reach
    // Bring them back together and finish it.
    for (let i = 0; i < 4; i++) {
      Object.assign(sim.players[1], { x: 0.05, y: 0 });
      run(sim, LIVE_ATTACK_COOLDOWN_MS);
      sim.players[0].attack = true;
      step(sim, rules);
    }
    expect(sim.players[1]).toMatchObject({ hp: 0, out: { by: "a" } });
    expect(sim.players[0].kills).toBe(1);
    expect(sim.done).toBe(true);
    expect(standings(sim).map((s) => `${s.rank}:${s.id}`)).toEqual(["1:a", "2:b"]);
  });

  it("drains HP outside the closing ring and ends at the time limit with the most HP first", () => {
    const sim = createSim(["a", "b", "c"]);
    const short: LiveRules = { battleSec: 30, ringShrink: true };
    // Everyone stays on the starting circle (0.6): after the 2nd 링 축소 (0.62) only the squeeze reaches them.
    run(sim, 17_000, short);
    expect(sim.players.every((p) => p.hp === LIVE_HP)).toBe(true);
    expect(ringAt(sim, short)).toBeCloseTo(0.62, 2);
    // 'a' walks to the middle and stays safe while the ring closes on the others.
    sim.players[0].input = { dx: 0, dy: 1 };
    run(sim, 1700, short);
    sim.players[0].input = { dx: 0, dy: 0 };
    run(sim, 30_000, short);
    expect(sim.done).toBe(true);
    const table = standings(sim);
    expect(table[0].id).toBe("a");
    expect(sim.players.filter((p) => p.out?.by === "RING").map((p) => p.id).sort()).toEqual(["b", "c"]);
    expect(sim.events.filter((e) => e.kind === "RING")).toHaveLength(2);
  });

  it("ranks standing fighters by HP then 처치, and the knocked out by who lasted longer", () => {
    const sim = createSim(["a", "b", "c", "d"]);
    Object.assign(sim.players[0], { hp: 40, kills: 1 });
    Object.assign(sim.players[1], { hp: 40, kills: 2 });
    Object.assign(sim.players[2], { hp: 0, out: { at: 9000, by: "b" } });
    Object.assign(sim.players[3], { hp: 0, out: { at: 12_000, by: "RING" } });
    expect(standings(sim).map((s) => `${s.rank}:${s.id}`)).toEqual(["1:b", "2:a", "3:d", "4:c"]);
  });
});
