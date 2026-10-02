import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
// The draw happens on the server; tests pick the roll.
const roll = vi.hoisted(() => ({ next: 0 }));
vi.mock("node:crypto", async (importOriginal) => ({ ...(await importOriginal<typeof import("node:crypto")>()), randomInt: () => roll.next }));

/** 기여도 강탈 룰렛 (code-first): creator-made slots, weighted server draw, capped transfer, retry safety. */
async function startLive() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const steal = await import("./crewSteal");
  const battle = await import("./crewBattle");
  await feed.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
  await feed.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
  expect(await bc.startBroadcast({ title: "강탈 방송", teamMode: false })).toEqual({ status: "SAVED" });
  const id = (await bc.getBroadcastView())!.live!.id;
  const view = async () => (await bc.getBroadcastView())!;
  let n = 100;
  const donate = (amount: number, message: string) => feed.simulateDonation({ broadcastId: id, requestId: key(n++), amount, unit: "FN", message });
  return { ...bc, ...steal, ...battle, id, view, donate };
}

const row = (v: { live: { rows: { memberId: string; score: number; stolen: number }[] } | null }, memberId: string) => v.live!.rows.find((r) => r.memberId === memberId)!;
// weights 1 · 1 · 2 → rolls 0 = 30%, 1 = 꽝, 2–3 = 5,000점
const SLOTS = [
  { label: "30%", kind: "PERCENT", value: 30, weight: 1 },
  { label: "꽝", kind: "MISS", value: 0, weight: 1 },
  { label: "오천", kind: "POINTS", value: 5_000, weight: 2 }
];

describe("기여도 강탈 룰렛", () => {
  beforeEach(() => resetMockStores());

  it("moves the drawn slot's points from the target to the thief, never more than the target has", async () => {
    const { setStealSlots, spinSteal, donate, view, id } = await startLive();
    expect((await spinSteal({ broadcastId: id, requestId: key(1), thiefId: "cm-s1", targetId: "cm-s2" })).status).toBe("INVALID"); // no slots yet
    expect(await setStealSlots({ slots: SLOTS })).toEqual({ status: "SAVED" });
    await donate(10_000, "하늘");

    roll.next = 0;
    const first = await spinSteal({ broadcastId: id, requestId: key(2), thiefId: "cm-s1", targetId: "cm-s2" });
    expect(first).toMatchObject({ status: "SPUN", slotIndex: 0, record: { thiefName: "길동", targetName: "하늘", slotLabel: "30%", points: 3_000 } });
    roll.next = 1;
    expect(await spinSteal({ broadcastId: id, requestId: key(2), thiefId: "cm-s1", targetId: "cm-s2" })).toEqual(first); // retry → same spin
    let v = await view();
    expect(row(v, "cm-s1")).toMatchObject({ stolen: 3_000, score: 3_000 });
    expect(row(v, "cm-s2")).toMatchObject({ stolen: -3_000, score: 7_000 });

    expect((await spinSteal({ broadcastId: id, requestId: key(3), thiefId: "cm-s1", targetId: "cm-s2" })).status).toBe("SPUN");
    v = await view();
    expect(v.live!.steals[0]).toMatchObject({ slotLabel: "꽝", points: 0 });

    roll.next = 3;
    await spinSteal({ broadcastId: id, requestId: key(4), thiefId: "cm-s1", targetId: "cm-s2" }); // 5,000 of 7,000
    await spinSteal({ broadcastId: id, requestId: key(5), thiefId: "cm-s1", targetId: "cm-s2" }); // capped at the 2,000 left
    v = await view();
    expect(v.live!.steals.slice(0, 2).map((s) => s.points)).toEqual([2_000, 5_000]);
    expect(row(v, "cm-s2").score).toBe(0);
    expect(row(v, "cm-s1").score).toBe(10_000);
  });

  it("counts inside a running battle and validates slots, BJs and the session", async () => {
    const { setStealSlots, spinSteal, startBattle, donate, view, id } = await startLive();
    await setStealSlots({ slots: SLOTS });
    await startBattle({ broadcastId: id, requestId: key(1), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 300 });
    await donate(4_000, "하늘");
    roll.next = 0;
    await spinSteal({ broadcastId: id, requestId: key(2), thiefId: "cm-s1", targetId: "cm-s2" });
    const b = (await view()).live!.battles[0];
    expect(b.sides.map((s) => s.score)).toEqual([1_200, 2_800]);

    expect((await setStealSlots({ slots: [{ label: "x", kind: "PERCENT", value: 101, weight: 1 }] })).status).toBe("INVALID");
    expect((await setStealSlots({ slots: [{ label: "", kind: "MISS", value: 0, weight: 1 }] })).status).toBe("INVALID");
    expect((await setStealSlots({ slots: [{ label: "x", kind: "POINTS", value: 10, weight: 0 }] })).status).toBe("INVALID");
    expect((await setStealSlots({ slots: Array.from({ length: 13 }, () => SLOTS[1]) })).status).toBe("INVALID");
    expect((await spinSteal({ broadcastId: id, requestId: key(3), thiefId: "cm-s1", targetId: "cm-s1" })).status).toBe("INVALID");
    expect((await spinSteal({ broadcastId: id, requestId: key(4), thiefId: "cm-s1", targetId: "cm-s4" })).status).toBe("INVALID"); // inactive
    signIn(["SUPPORTER"]);
    expect(await spinSteal({ broadcastId: id, requestId: key(5), thiefId: "cm-s1", targetId: "cm-s2" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
