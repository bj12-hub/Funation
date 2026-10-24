import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원자 이름 병합 · 출처 · 기여도 내역 (2026-10-25, StreamDonate 후원 및 통합 관리 참고). */
async function load() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const core = await import("./crewCore");
  const history = await import("./crewHistory");
  const battle = await import("./crewBattle");
  const crew = await import("./crew");
  const { mockCrew } = await import("./mockCrewStore");
  // The seed's 멤버 지정 후원 are stamped around now; these tests count only their own.
  mockCrew.attributions = [];
  return { ...bc, ...feed, ...core, ...history, ...battle, ...crew, mockCrew };
}

const at = (s: string) => vi.setSystemTime(new Date(`2026-10-25T12:${s}Z`));

describe("후원자 이름 병합", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("validates the groups and keeps their ids", async () => {
    const m = await load();
    const bad: [unknown, string][] = [
      ["별빛", "50개"],
      [Array.from({ length: 51 }, (_, i) => ({ name: `n${i}`, aliases: [`a${i}`] })), "50개"],
      [[{ name: " ", aliases: ["a"] }], "대표 이름"],
      [[{ name: "가".repeat(61), aliases: ["a"] }], "대표 이름"],
      [[{ name: "admin팬", aliases: ["a"] }], "사용할 수 없는"],
      [[{ name: "별빛", aliases: "a" }], "합칠 이름을 확인"],
      [[{ name: "별빛", aliases: [" 별 빛 ", ""] }], "별빛에 합칠 이름"],
      [[{ name: "별빛", aliases: Array.from({ length: 11 }, (_, i) => `a${i}`) }], "10개"],
      [[{ name: "별빛", aliases: ["가".repeat(61)] }], "60자"],
      [[{ name: "별빛", aliases: ["달빛"] }, { name: "달빛", aliases: ["햇빛"] }], "'달빛' 이름은 다른 병합"]
    ];
    for (const [merges, message] of bad) {
      const res = await m.saveDonorMerges({ merges });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    expect(await m.saveDonorMerges({ merges: [{ name: " 별빛 ", aliases: ["별빛소나타", " 별 빛 ", "STAR light", "별빛소나타"] }] })).toEqual({ status: "SAVED" });
    const [saved] = (await m.getBroadcastView())!.donorMerges;
    expect(saved).toMatchObject({ name: "별빛", aliases: ["별빛소나타", "STAR light"] });
    await m.saveDonorMerges({ merges: [{ id: saved.id, name: "별빛", aliases: ["별빛소나타"] }, { id: "dm-made-up", name: "치즈", aliases: ["치즈냥"] }] });
    const again = (await m.getBroadcastView())!.donorMerges;
    expect(again[0].id).toBe(saved.id);
    expect(again[1].id).not.toBe("dm-made-up");
    signIn(["SUPPORTER"]);
    expect(await m.saveDonorMerges({ merges: [] })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("reads merged names in the 후원 리스트, the 중복 의심 check and 후원자별 정리 — never on stream", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.saveDonorMerges({ merges: [{ name: "별빛", aliases: ["별빛소나타", "star light"] }] });
    await m.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "병합", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    let n = 0;
    const sim = (donor: string, amount: number, unit = "FN", message = "") => m.simulateDonation({ broadcastId: id, requestId: key(++n), donor, amount, unit, message });

    await sim("별빛소나타", 5_000, "FN", "하늘");
    at("00:20");
    await sim("Star Light", 5_000); // another name of the same donor → 중복 의심
    await sim("치즈냥", 2_000, "SOOP_BALLOON");
    m.attributeMemberDonation("dn-1", "studio", "cm-s1", 1_000, { donor: "별빛", donorId: "star", message: "", shownDonor: "별빛" });
    m.attributeMemberDonation("dn-2", "studio", "cm-s1", 3_000, { donor: "치즈냥", donorId: "cheese", message: "", shownDonor: "치즈냥" });

    const feed = (await m.getBroadcastView())!.feed!;
    expect(feed.entries.map((e) => [e.donor, e.mergedDonor, !!e.duplicateOf])).toEqual([
      ["치즈냥", null, false],
      ["Star Light", "별빛", true],
      ["별빛소나타", "별빛", false]
    ]);
    // 별풍선 has no 환산값 on the FN basis: 0 points, still a 건.
    expect(feed.donors).toEqual([
      { name: "별빛", names: ["별빛소나타", "Star Light", "별빛"], count: 3, points: 11_000 },
      { name: "치즈냥", names: ["치즈냥"], count: 2, points: 3_000 }
    ]);
    // A cancelled entry leaves 후원자별 정리.
    await m.cancelFeedEntry({ broadcastId: id, entryId: feed.entries[1].id });
    expect((await m.getBroadcastView())!.feed!.donors[0]).toEqual({ name: "별빛", names: ["별빛소나타", "별빛"], count: 2, points: 6_000 });
    // On stream nothing changes: the overlay view has no feed, and alerts keep the name as sent.
    const overlay = await m.getOverlayScoreboard((await import("@/services/creator/mockCreatorStore")).mockCreator.integrationKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && "feed" in overlay).toBe(false);
  });
});

describe("기여도 내역", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("lists every score change by kind, adding up to each member's scoreboard score, live and after the end", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.saveCrewGrades({ grades: [{ name: "부장", multiplier: 1.5 }] });
    await m.updateCrewMember("cm-s1", { gradeId: (await m.getCrewStudio())!.grades[0].id });
    await m.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
    await m.saveDonorMerges({ merges: [{ name: "별빛", aliases: ["별빛소나타"] }] });
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "내역 방송", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;

    at("00:10");
    expect(await m.startBattle({ broadcastId: id, requestId: key(1), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 120, multiplier: 2 })).toEqual({ status: "SAVED" });
    at("00:20");
    await m.simulateDonation({ broadcastId: id, requestId: key(2), donor: "별빛소나타", amount: 10_000, unit: "FN", message: "길동" });
    m.attributeMemberDonation("dn-1", "studio", "cm-s2", 4_000, { donor: "치즈냥", donorId: "cheese", message: "", shownDonor: "치즈냥" });
    await m.adjustScore({ broadcastId: id, memberId: "cm-s3", points: 500, adjustmentId: key(3), reason: "벌칙 성공" });
    // A 기여도 강탈 and a 점수 게임 run (with a 몰수권 share), as their engines record them.
    const live = m.mockCrew.broadcasts!.find((b) => b.id === id)!;
    live.steals = [{ id: "st-1", at: new Date().toISOString(), thief: "cm-s3", target: "cm-s2", slotId: "sl-1", slotLabel: "30%", points: 1_000 }];
    const run = { id: "gr-1", game: "SIG_HUNTER", at: new Date().toISOString(), showAt: new Date().toISOString(), revealAt: new Date().toISOString(), memberId: "cm-s2", trigger: { kind: "MANUAL" }, sourceId: null, basePoints: 0, itemId: null, label: "SOLD OUT", kind: "ADD", value: 700, points: 700, shares: [{ memberId: "cm-s1", points: 200 }] } as const;
    live.gameRuns = [structuredClone(run) as never];
    at("03:00"); // the battle (12:00:10 ~ 12:02:10) is over

    const check = async () => {
      const res = await m.getContributionHistory({ broadcastId: id });
      if (res.status !== "OK") throw new Error(res.status);
      const rows = (await m.getBroadcastView())!.live?.rows ?? (await import("./crewCore")).scoreboardRows(live);
      for (const r of rows) expect(res.history.lines.filter((l) => l.memberId === r.memberId).reduce((s, l) => s + l.points, 0), r.name).toBe(r.score);
      return res.history.lines;
    };
    const lines = await check();
    // Newest first (lines at the same moment in a fixed order), 직급 배수 for the whole broadcast last.
    expect(lines.map((l) => `${l.kind} ${l.memberName} ${l.points} ${l.label} | ${l.detail}`)).toEqual([
      "ADJUST 바다 500 보정 | 벌칙 성공",
      "DONATION 하늘 4000 치즈냥 · 4,000 FN | 멤버 지정 후원",
      "FEED 길동 10000 별빛 (별빛소나타) · 10,000 FN | 시뮬",
      "GAME 하늘 700 시그니처 헌터 · SOLD OUT | OBS에 결과가 나온 뒤 반영",
      "GAME 길동 200 시그니처 헌터 · SOLD OUT | 몰수권",
      "STEAL 바다 1000 기여도 강탈 · 30% | 하늘에게서 가져옴",
      "STEAL 하늘 -1000 기여도 강탈 · 30% | 바다에게 빼앗김",
      "BATTLE 길동 10000 배틀 1 · ×2 | 배틀 1 · 배틀 중 받은 10,000점",
      "BATTLE 하늘 4000 배틀 1 · ×2 | 배틀 1 · 배틀 중 받은 4,000점",
      "GRADE 길동 5000 직급 배수 · ×1.5 | 이번 방송에 받은 후원 기준"
    ]);
    expect(lines.at(-1)!.at).toBeNull();

    await m.endBroadcast(id);
    expect(await check()).toHaveLength(lines.length);

    expect(await m.getContributionHistory({ broadcastId: "bc-nope" })).toEqual({ status: "INVALID", message: "방송을 찾을 수 없어요." });
    expect((await m.getContributionHistory({ broadcastId: "bc-seed-c4" })).status).toBe("INVALID"); // another channel's broadcast
    signIn(["SUPPORTER"]);
    expect(await m.getContributionHistory({ broadcastId: id })).toEqual({ status: "UNAUTHORIZED" });
  });
});
