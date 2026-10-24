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
  const cumulative = await import("./crewCumulative");
  const battle = await import("./crewBattle");
  const crew = await import("./crew");
  const { mockCrew } = await import("./mockCrewStore");
  // The seed's 멤버 지정 후원 are stamped around now; these tests count only their own.
  mockCrew.attributions = [];
  return { ...bc, ...feed, ...core, ...history, ...cumulative, ...battle, ...crew, mockCrew };
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

/** Two 회차 of 시즌1 (the second live) and a broadcast without a project, scored with 보정 only. */
async function seasons() {
  vi.useFakeTimers({ now: new Date("2026-10-25T10:00:00Z"), toFake: ["Date"] });
  const m = await load();
  let n = 0;
  const run = async (title: string, project: string, points: Record<string, number>, end = true) => {
    expect(await m.startBroadcast({ requestId: crypto.randomUUID(), title, project, teamMode: false })).toEqual({ status: "SAVED" });
    const id = (await m.getBroadcastView())!.live!.id;
    for (const [memberId, p] of Object.entries(points)) await m.adjustScore({ broadcastId: id, memberId, points: p, adjustmentId: key(++n) });
    vi.setSystemTime(Date.now() + 3_600_000);
    if (end) await m.endBroadcast(id);
    return id;
  };
  expect(await m.addCrewMember({ requestId: crypto.randomUUID(), name: "별", role: "MEMBER" })).toEqual({ status: "SAVED" });
  const star = (await m.getCrewStudio())!.members.find((x) => x.name === "별")!.id;
  await run("개인 방송", "", { "cm-s3": 700 });
  const first = await run("시즌1/첫 방송", "시즌1", { "cm-s1": 3_000, "cm-s2": 1_000, [star]: 2_000 });
  await m.removeCrewMember(star);
  const second = await run("둘째 날", "시즌1", { "cm-s2": 5_000 }, false);
  return { ...m, first, second, star };
}

describe("기여도 내보내기", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("exports a project's 회차 side by side and every line, and one broadcast's lines", async () => {
    const m = await seasons();
    const rounds = await m.exportContributions({ project: "시즌1", format: "ROUNDS" });
    expect(rounds).toMatchObject({ status: "OK", filename: "기여도-시즌1-회차별.csv", rows: 4, truncated: false });
    if (rounds.status !== "OK") throw new Error();
    // Final scores per 회차 (the live one now), best total first; a member removed since keeps their 회차 name.
    expect(rounds.csv.replace("﻿", "").split("\r\n")).toEqual(["멤버,1회차,2회차 (진행 중),합계", "하늘,1000,5000,6000", "길동,3000,0,3000", "별,2000,0,2000", "바다,0,0,0", "합계,6000,5000,11000"]);

    const lines = await m.exportContributions({ project: "시즌1", format: "LINES" });
    if (lines.status !== "OK") throw new Error();
    const rows = lines.csv.replace("﻿", "").split("\r\n");
    expect(rows[0]).toBe("회차,방송,시각,멤버,종류,내용,상세,점수");
    // 회차 oldest first (the 시각 column left out here). 별 was removed from the crew: like the scoreboard, the
    // recomputed lines leave them out.
    expect(rows.slice(1).map((r) => r.split(",").filter((_, i) => i !== 2).join(","))).toEqual([
      "1회차,시즌1/첫 방송,길동,보정,보정,사유 없음,3000",
      "1회차,시즌1/첫 방송,하늘,보정,보정,사유 없음,1000",
      "2회차 (진행 중),둘째 날,하늘,보정,보정,사유 없음,5000"
    ]);

    const none = await m.exportContributions({ project: null, format: "ROUNDS" });
    expect(none).toMatchObject({ status: "OK", filename: "기여도-프로젝트 없음-회차별.csv" });
    expect(none.status === "OK" && none.csv).toContain("개인 방송");

    const one = await m.exportContributions({ broadcastId: m.first, format: "LINES" });
    expect(one).toMatchObject({ status: "OK", filename: "기여도내역-시즌1_첫 방송.csv", rows: 2 });

    for (const [input, message] of [
      [{ broadcastId: m.first, format: "ROUNDS" }, "프로젝트로"],
      [{ project: "시즌1", format: "XLSX" }, "형식"],
      [{ project: 3, format: "ROUNDS" }, "프로젝트를"],
      [{ project: "시즌9", format: "ROUNDS" }, "내보낼 방송이 없어요"],
      [{ broadcastId: "bc-seed-c4", format: "LINES" }, "방송을 찾을 수 없어요"]
    ] as const) {
      const res = await m.exportContributions(input);
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.exportContributions({ project: "시즌1", format: "ROUNDS" })).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("누적 기여도", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("adds the project's ended 회차 to the live scoreboard, and is shown on OBS after OBS에 표시", async () => {
    const m = await seasons();
    const { cumulative } = (await m.getBroadcastView())!.live!;
    expect(cumulative).toMatchObject({ project: "시즌1", rounds: 2, total: 11_000, visible: false });
    expect(cumulative.rows.map((r) => `${r.rank} ${r.name} ${r.past}+${r.current}=${r.total} ${r.color}`)).toEqual([
      "1 하늘 1000+5000=6000 #ec4899",
      "2 길동 3000+0=3000 #8b5cf6",
      "3 별 2000+0=2000 #9ca3af",
      "4 바다 0+0=0 #3b82f6"
    ]);

    expect((await m.setCumulativeVisible({ broadcastId: m.second, on: "yes" })).status).toBe("INVALID");
    expect((await m.setCumulativeVisible({ broadcastId: m.first, on: true })).status).toBe("INVALID"); // ended
    expect(await m.setCumulativeVisible({ broadcastId: m.second, on: true })).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayScoreboard((await import("@/services/creator/mockCreatorStore")).mockCreator.integrationKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.cumulative.visible).toBe(true);

    // Without a project only this broadcast counts.
    await m.endBroadcast(m.second);
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "번외", teamMode: false });
    expect((await m.getBroadcastView())!.live!.cumulative).toMatchObject({ project: null, rounds: 1, total: 0 });
  });

  it("validates and keeps the settings", async () => {
    const m = await load();
    const ok = { title: " 시즌 누적 ", rows: 5, showBreakdown: false, showRounds: true, placement: "RIGHT" };
    expect(await m.saveCumulative(ok)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.cumulativeSettings).toEqual({ ...ok, title: "시즌 누적" });
    for (const [patch, message] of [
      [{ title: "가".repeat(21) }, "제목"],
      [{ title: "admin 누적" }, "사용할 수 없는"],
      [{ rows: 4 }, "멤버 수"],
      [{ placement: "TOP" }, "배치"],
      [{ showRounds: "yes" }, "표시 설정"]
    ] as const) {
      const res = await m.saveCumulative({ ...ok, ...patch });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveCumulative(ok)).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.setCumulativeVisible({ broadcastId: "x", on: true })).toEqual({ status: "UNAUTHORIZED" });
  });
});
