import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_GAUGE, type GaugeSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** BJ 공약 · 출근 BJ 게이지 (2026-10-25, StreamDonate BJ 게이지 · BJ 공약 · 출근 참고). */
async function load() {
  const bc = await import("./crewBroadcast");
  const gauge = await import("./crewGauge");
  const crew = await import("./crew");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  return { ...bc, ...gauge, ...crew, overlayKey: mockCreator.integrationKey };
}

const settings = (patch: Partial<GaugeSettings> = {}) => ({ ...DEFAULT_GAUGE, ...patch });
const PLEDGES = {
  "cm-s1": { text: "10만 점이면 노래 한 곡", goal: 100_000 },
  "cm-s2": { text: "", goal: 5_000 },
  "cm-s3": { text: "먹방 30분", goal: 0 },
  "cm-s4": { text: "휴식 중 공약", goal: 1_000 }
};

describe("BJ 공약", () => {
  beforeEach(() => resetMockStores());

  it("validates and saves every member's 공약 and goal, leaving out members with neither", async () => {
    const m = await load();
    expect(await m.savePledges({ pledges: { ...PLEDGES, "cm-s1": { text: " 10만 점이면 노래 한 곡 ", goal: 100_000 } } })).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.pledges).toEqual(PLEDGES);
    expect(await m.savePledges({ pledges: { "cm-s1": { text: " ", goal: 0 } } })).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.pledges).toEqual({});

    for (const [pledges, message] of [
      [[], "공약을 확인"],
      [{ "cm-nobody": { text: "x", goal: 0 } }, "멤버를 찾을 수 없어요"],
      [{ "cm-s1": { text: "가".repeat(41), goal: 0 } }, "40자"],
      [{ "cm-s1": { text: "admin 공약", goal: 0 } }, "사용할 수 없는"],
      [{ "cm-s1": { text: "", goal: -1 } }, "목표 점수"],
      [{ "cm-s1": { text: "", goal: 1.5 } }, "목표 점수"],
      [{ "cm-s1": { text: "", goal: 100_000_001 } }, "목표 점수"]
    ] as const) {
      const res = await m.savePledges({ pledges });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.savePledges({ pledges: {} })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("shows active members' 공약 on the public crew, with their live score while a broadcast runs", async () => {
    const m = await load();
    await m.savePledges({ pledges: PLEDGES });
    let pub = await m.getCrewPublic("studio");
    expect(pub.members.map((x) => [x.name, x.pledge?.text ?? null, x.score])).toEqual([
      ["길동", "10만 점이면 노래 한 곡", null],
      ["하늘", "", null],
      ["바다", "먹방 30분", null]
    ]); // 솔 is on 휴식: not listed
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "공약 방송", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    await m.adjustScore({ broadcastId: id, memberId: "cm-s1", points: 32_000, adjustmentId: key(1) });
    pub = await m.getCrewPublic("studio");
    expect(pub.members.map((x) => x.score)).toEqual([32_000, 0, 0]);
    // A removed member's 공약 leaves with them.
    await m.removeCrewMember("cm-s3");
    expect((await m.getBroadcastView())!.pledges).not.toHaveProperty("cm-s3");
  });
});

describe("출근 BJ 게이지", () => {
  beforeEach(() => resetMockStores());

  it("shows 출근 members with a goal against their broadcast score, and is shown on OBS after OBS에 표시", async () => {
    const m = await load();
    await m.savePledges({ pledges: PLEDGES });
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "게이지 방송", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    await m.adjustScore({ broadcastId: id, memberId: "cm-s1", points: 32_500, adjustmentId: key(1) });
    await m.adjustScore({ broadcastId: id, memberId: "cm-s2", points: 7_000, adjustmentId: key(2) });
    const line = (rows: { name: string; score: number; goal: number; percent: number; reached: boolean; pledge: string }[]) =>
      rows.map((r) => `${r.name} ${r.score}/${r.goal} ${r.percent}%${r.reached ? " 달성" : ""} ${r.pledge || "-"}`);

    let gauge = (await m.getBroadcastView())!.live!.gauge;
    // 바다 has no goal; 솔 is on 휴식 (출근 BJ만).
    expect(line(gauge.rows)).toEqual(["길동 32500/100000 32% 10만 점이면 노래 한 곡", "하늘 7000/5000 100% 달성 -"]);
    expect(gauge.visible).toBe(false);

    expect(await m.saveGauge(settings({ activeOnly: false }))).toEqual({ status: "SAVED" });
    gauge = (await m.getBroadcastView())!.live!.gauge;
    expect(gauge.rows.map((r) => `${r.name}${r.active ? "" : " (휴식)"}`)).toEqual(["길동", "하늘", "솔 (휴식)"]);

    // A score below 0 shows an empty gauge.
    await m.adjustScore({ broadcastId: id, memberId: "cm-s1", points: -40_000, adjustmentId: key(3) });
    expect((await m.getBroadcastView())!.live!.gauge.rows[0]).toMatchObject({ score: -7_500, percent: 0, reached: false });

    expect((await m.setGaugeVisible({ broadcastId: id, on: "yes" })).status).toBe("INVALID");
    expect((await m.setGaugeVisible({ broadcastId: "bc-other", on: true })).status).toBe("INVALID");
    expect(await m.setGaugeVisible({ broadcastId: id, on: true })).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.gauge.visible).toBe(true);
    signIn(["SUPPORTER"]);
    expect(await m.setGaugeVisible({ broadcastId: id, on: false })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("validates and keeps the settings", async () => {
    const m = await load();
    const ok = settings({ title: " 오늘의 목표 ", numbers: "PERCENT", placement: "LEFT", showPledge: false });
    expect(await m.saveGauge(ok)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.gaugeSettings).toEqual({ ...ok, title: "오늘의 목표" });
    for (const [patch, message] of [
      [{ title: "가".repeat(21) }, "제목"],
      [{ title: "admin 목표" }, "사용할 수 없는"],
      [{ numbers: "BAR" }, "숫자 표시"],
      [{ placement: "TOP" }, "배치"],
      [{ activeOnly: "yes" }, "표시 설정"]
    ] as const) {
      const res = await m.saveGauge({ ...ok, ...patch });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveGauge(ok)).toEqual({ status: "UNAUTHORIZED" });
  });
});
