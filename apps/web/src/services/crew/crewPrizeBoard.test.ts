import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_PRIZE_BOARD, DEFAULT_TEAM_PRIZE_BOARD, type PrizeBoardSettings, type TeamPrizeSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 상품 순위표 (code-first, StreamDonate 랭킹(상품) · 시간 내 랭킹 참고): prizes per rank on the main or a 구간 score. */
async function load() {
  const bc = await import("./crewBroadcast");
  const prize = await import("./crewPrizeBoard");
  const prizeCore = await import("./crewPrizeCore");
  const feed = await import("./crewFeed");
  const core = await import("./crewCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  return { ...bc, ...prize, ...prizeCore, ...feed, ...core, overlayKey: mockCreator.integrationKey };
}

const settings = (patch: Partial<PrizeBoardSettings> = {}) => ({ ...DEFAULT_PRIZE_BOARD, ...patch });
const board = async (m: Awaited<ReturnType<typeof load>>) => (await m.getBroadcastView())!.live!.prizeBoard;
const line = (b: { rows: { name: string; rank: number | null; prize: { text: string } | null; score: number }[] }) =>
  b.rows.map((r) => `${r.rank ?? "고정"} ${r.name} ${r.prize?.text ?? "-"} ${r.score}`);

describe("상품 순위표", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("ranks by score with ties by name, gives each rank its line and leaves out excluded members", async () => {
    const { prizeRows } = await load();
    const members = [
      { memberId: "a", name: "다", color: "#111111", score: 5 },
      { memberId: "b", name: "가", color: "#222222", score: 9 },
      { memberId: "c", name: "나", color: "#333333", score: 5 },
      { memberId: "d", name: "라", color: "#444444", score: 1 }
    ];
    const prizes = [{ text: "상금", color: "#ffcc00" }, { text: "", color: null }, { text: "벌칙", color: null }];
    const out = prizeRows(members, settings({ prizes, excluded: ["d"] }));
    expect(line(out)).toEqual(["1 가 상금 9", "2 나 - 5", "3 다 벌칙 5"]);
    expect(out.rows[0].prize).toEqual({ text: "상금", color: "#ffcc00" });
    expect(out.total).toBe(19);

    // 상단 고정: first, no rank, its own text; the others are ranked from 1 and keep the prize lines.
    const pinned = prizeRows(members, settings({ prizes, pinned: { memberId: "b", text: "MC" } }));
    expect(line(pinned)).toEqual(["고정 가 MC 9", "1 나 상금 5", "2 다 - 5", "3 라 벌칙 1"]);

    // 표시 대상 점수 받은 멤버만 (2026-10-28): above 0 only, the top N — the pinned one anyway, the prizes by the ranks shown.
    const zero = [...members, { memberId: "e", name: "마", color: "#555555", score: 0 }];
    expect(line(prizeRows(zero, settings({ prizes, audience: "SCORED", limit: 2 })))).toEqual(["1 가 상금 9", "2 나 - 5"]);
    expect(line(prizeRows(zero, settings({ prizes, audience: "SCORED", limit: 50, pinned: { memberId: "e", text: "MC" } })))).toEqual([
      "고정 마 MC 0",
      "1 가 상금 9",
      "2 나 - 5",
      "3 다 벌칙 5",
      "4 라 - 1"
    ]);
    expect(prizeRows(zero, settings({ prizes }))).toMatchObject({ rows: { length: 5 } });
  });

  it("validates and saves the settings, trimming blank lines and colors without text", async () => {
    const m = await load();
    const ok = { ...settings(), title: " 식사대전 ", prizes: [{ text: "스테이크", color: "#FFAA00" }, { text: "", color: "#123456" }, { text: " ", color: null }] };
    expect(await m.savePrizeBoard(ok)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.prizeSettings).toMatchObject({ title: "식사대전", prizes: [{ text: "스테이크", color: "#ffaa00" }], titleColor: null });
    // 제목 색 (2026-10-28): kept lowercased on both boards; a screen from before sends none — 원래 색.
    expect(await m.savePrizeBoard({ ...ok, titleColor: "#FC8383" })).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.prizeSettings.titleColor).toBe("#fc8383");
    const { titleColor: _c, ...older } = settings();
    expect(_c).toBeNull();
    expect(await m.savePrizeBoard(older)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.prizeSettings.titleColor).toBeNull();
    // 테두리색 (2026-10-28): kept lowercased with its line, dropped with an empty line; 표시 대상 · 인원 kept.
    expect(await m.savePrizeBoard({ ...ok, audience: "SCORED", limit: 3, prizes: [{ text: "상금", color: null, outline: "#00FF00" }, { text: "", color: null, outline: "#123456" }, { text: "벌칙", color: null }] })).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.prizeSettings).toMatchObject({
      audience: "SCORED",
      limit: 3,
      prizes: [{ text: "상금", color: null, outline: "#00ff00" }, { text: "", color: null, outline: null }, { text: "벌칙", color: null, outline: null }]
    });
    const { audience: _a, limit: _l, ...before } = settings();
    expect([_a, _l]).toEqual(["ALL", 10]);
    expect(await m.savePrizeBoard(before)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.prizeSettings).toMatchObject({ audience: "ALL", limit: 10 });

    const bad: [Record<string, unknown>, string][] = [
      [{ title: "가".repeat(21) }, "제목"],
      [{ basis: "MONTH" }, "집계 기준"],
      [{ prizes: [{ text: "가".repeat(31), color: null }] }, "30자"],
      [{ prizes: [{ text: "상금", color: "red" }] }, "글자색"],
      [{ prizes: [{ text: "상금", color: null, outline: "black" }] }, "테두리색"],
      [{ audience: "TOP" }, "표시 대상"],
      [{ audience: "SCORED", limit: 0 }, "표시 대상"],
      [{ limit: 51 }, "표시 대상"],
      [{ prizes: Array.from({ length: 31 }, () => ({ text: "x", color: null })) }, "30등"],
      [{ excluded: ["cm-nobody"] }, "뺄 멤버"],
      [{ excluded: ["cm-s1"], pinned: { memberId: "cm-s1", text: "" } }, "상단 고정"],
      [{ pinned: { memberId: "cm-s1", text: "운영자 고정" } }, "사용할 수 없는"],
      [{ columns: 4 }, "열 개수"],
      [{ titleColor: "red" }, "제목 색"],
      [{ placement: "TOP" }, "배치"],
      [{ showScore: "yes" }, "표시 설정"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.savePrizeBoard({ ...settings(), ...patch });
      expect(res.status, message).toBe("INVALID");
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.savePrizeBoard(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("uses the main scoreboard score (보정 included) on the broadcast basis", async () => {
    const m = await load();
    await m.savePrizeBoard(settings({ prizes: [{ text: "1등 상품", color: null }] }));
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    m.attributeMemberDonation("dn-1", "studio", "cm-s2", 3_000);
    await m.adjustScore({ broadcastId: id, memberId: "cm-s3", points: 5_000, adjustmentId: key(1) });
    const b = await board(m);
    expect(line(b).slice(0, 2)).toEqual(["1 바다 1등 상품 5000", "2 하늘 - 3000"]);
    expect(b.visible).toBe(false);
  });

  it("counts only the 구간 between 시작 and 정지 on the window basis", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-23T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    expect((await m.startPrizeWindow({ broadcastId: id, requestId: key(1) })).status).toBe("INVALID"); // broadcast basis
    await m.savePrizeBoard(settings({ basis: "WINDOW" }));
    expect((await m.stopPrizeWindow({ broadcastId: id })).status).toBe("INVALID"); // nothing to stop

    vi.setSystemTime(new Date("2026-10-23T12:01:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(10), amount: 1_000, message: "하늘" }); // before the 구간
    expect((await board(m)).window).toBeNull();
    expect((await board(m)).rows.every((r) => r.score === 0)).toBe(true);

    vi.setSystemTime(new Date("2026-10-23T12:02:00Z"));
    await m.startPrizeWindow({ broadcastId: id, requestId: key(2) });
    vi.setSystemTime(new Date("2026-10-23T12:03:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(11), amount: 4_000, message: "하늘" });
    await m.adjustScore({ broadcastId: id, memberId: "cm-s1", points: 9_000, adjustmentId: key(3) }); // 보정 is not a 구간 score
    await m.startPrizeWindow({ broadcastId: id, requestId: key(2) }); // retried start: no restart
    expect((await board(m)).rows.find((r) => r.memberId === "cm-s2")!.score).toBe(4_000);
    expect((await board(m)).rows.find((r) => r.memberId === "cm-s1")!.score).toBe(0);

    vi.setSystemTime(new Date("2026-10-23T12:04:00Z"));
    await m.stopPrizeWindow({ broadcastId: id });
    vi.setSystemTime(new Date("2026-10-23T12:05:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(12), amount: 7_000, message: "하늘" });
    const stopped = await board(m);
    expect(stopped.window).toEqual({ startedAt: "2026-10-23T12:02:00.000Z", stoppedAt: "2026-10-23T12:04:00.000Z" });
    expect(stopped.rows[0]).toMatchObject({ memberId: "cm-s2", rank: 1, score: 4_000 });

    // 다시 시작 counts from now.
    vi.setSystemTime(new Date("2026-10-23T12:06:00Z"));
    await m.startPrizeWindow({ broadcastId: id, requestId: key(4) });
    expect((await board(m)).rows.every((r) => r.score === 0)).toBe(true);

    // 시작점 수정 (2026-10-28): back to the 12:05 donation — it counts again.
    const moments = (await m.getBroadcastView())!.live!.moments;
    expect(moments.map((x) => [x.at, x.amount])).toEqual([
      ["2026-10-23T12:05:00.000Z", 7_000],
      ["2026-10-23T12:03:00.000Z", 4_000],
      ["2026-10-23T12:01:00.000Z", 1_000]
    ]);
    expect(await m.movePrizeWindowStart({ broadcastId: id, at: moments[0].at })).toEqual({ status: "SAVED" });
    expect((await board(m)).window!.startedAt).toBe("2026-10-23T12:05:00.000Z");
    expect((await board(m)).rows.find((r) => r.memberId === "cm-s2")!.score).toBe(7_000);
    for (const at of ["2026-10-23T11:00:00.000Z", "2026-10-23T12:30:00.000Z", "어제", 3]) {
      expect(await m.movePrizeWindowStart({ broadcastId: id, at })).toEqual({ status: "INVALID", message: "시작점은 방송 시작부터 지금 사이로 골라 주세요." });
    }
    vi.setSystemTime(new Date("2026-10-23T12:06:30Z"));
    await m.stopPrizeWindow({ broadcastId: id });
    expect(await m.movePrizeWindowStart({ broadcastId: id, at: moments[1].at })).toEqual({ status: "INVALID", message: "집계 중인 구간의 시작점만 고칠 수 있어요." });
    await m.startPrizeWindow({ broadcastId: id, requestId: key(5) }); // running again for the end below

    // 방송 종료 stops a running 구간.
    vi.setSystemTime(new Date("2026-10-23T12:07:00Z"));
    await m.endBroadcast(id);
    const ended = (await import("./mockCrewStore")).mockCrew.broadcasts!.find((b) => b.id === id)!;
    expect(ended.prizeBoard!.window!.stoppedAt).toBe("2026-10-23T12:07:00.000Z");
  });

  it("is shown on the OBS overlay only after OBS에 표시, and only by the creator", async () => {
    const m = await load();
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    expect((await m.setPrizeBoardVisible({ broadcastId: id, on: "yes" })).status).toBe("INVALID");
    expect(await m.setPrizeBoardVisible({ broadcastId: id, on: true })).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.prizeBoard.visible).toBe(true);
    expect((await m.setPrizeBoardVisible({ broadcastId: "bc-other", on: false })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.setPrizeBoardVisible({ broadcastId: id, on: false })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.startPrizeWindow({ broadcastId: id, requestId: key(9) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.stopPrizeWindow({ broadcastId: id })).toEqual({ status: "UNAUTHORIZED" });
  });
});

/** 팀 순위표 (code-first, StreamDonate 팀 랭킹(상품) 참고): prizes per team rank, team score = its members' scores. */
const teamSettings = (patch: Partial<TeamPrizeSettings> = {}): TeamPrizeSettings => ({ ...DEFAULT_TEAM_PRIZE_BOARD, ...patch });
const twoTeams = [
  { name: "불꽃", memberIds: ["cm-s1", "cm-s2"] },
  { name: "", memberIds: ["cm-s3"] }
];
const teamBoard = async (m: Awaited<ReturnType<typeof load>>) => (await m.getBroadcastView())!.live!.teamPrize;
const teamLine = (b: { rows: { name: string; rank: number; prize: { text: string } | null; score: number; members: { name: string; score: number }[] }[] }) =>
  b.rows.map((r) => `${r.rank} ${r.name} ${r.prize?.text ?? "-"} ${r.score} [${r.members.map((x) => `${x.name} ${x.score}`).join(", ")}]`);

describe("팀 순위표", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("ranks teams by the sum of their members (a tie keeps the set-up order) and lists members best first", async () => {
    const { teamPrizeRows } = await load();
    const mem = (memberId: string, name: string, score: number) => ({ memberId, name, color: "#111111", score });
    const out = teamPrizeRows(
      [
        { key: "A", name: "가팀", color: "#3b82f6", members: [mem("a", "다", 2), mem("b", "가", 3)] },
        { key: "B", name: "나팀", color: "#ec4899", members: [mem("c", "나", 9)] },
        { key: "C", name: "다팀", color: "#10b981", members: [mem("d", "라", 4), mem("e", "마", 4)] },
        { key: "D", name: "라팀", color: "#f59e0b", members: [] }
      ],
      { prizes: [{ text: "회식", color: "#ffcc00" }, { text: "", color: null }, { text: "벌칙", color: null }] }
    );
    expect(teamLine(out)).toEqual(["1 나팀 회식 9 [나 9]", "2 다팀 - 8 [라 4, 마 4]", "3 가팀 벌칙 5 [가 3, 다 2]", "4 라팀 - 0 []"]);
    expect(out.total).toBe(22);
    const tie = teamPrizeRows([{ key: "A", name: "가팀", color: "#3b82f6", members: [mem("a", "x", 1)] }, { key: "B", name: "나팀", color: "#ec4899", members: [mem("b", "y", 1)] }], { prizes: [] });
    expect(tie.rows.map((r) => `${r.rank} ${r.name}`)).toEqual(["1 가팀", "2 나팀"]);
  });

  it("validates and saves the settings: CUSTOM needs 2 ~ 8 teams, each named once and with members in one team only", async () => {
    const m = await load();
    expect(await m.saveTeamPrize(teamSettings({ title: " 팀 대항전 ", teams: twoTeams, prizes: [{ text: "회식", color: "#FFAA00" }, { text: "", color: null }], titleColor: "#00AAFF" }))).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.teamPrizeSettings).toMatchObject({ title: "팀 대항전", source: "CUSTOM", teams: [{ name: "불꽃" }, { name: "B팀" }], prizes: [{ text: "회식", color: "#ffaa00" }], titleColor: "#00aaff" });
    expect((await m.getBroadcastView())!.teamPrizeSettings.membersPerLine).toBe(0);
    // 한 줄에 놓을 팀원 수 (2026-10-28): kept; a screen from before sends none — as many as fit.
    expect(await m.saveTeamPrize(teamSettings({ teams: twoTeams, membersPerLine: 3 }))).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.teamPrizeSettings.membersPerLine).toBe(3);
    for (const bad of [-1, 21, 1.5, "3"]) {
      expect(await m.saveTeamPrize(teamSettings({ teams: twoTeams, membersPerLine: bad as never }))).toEqual({ status: "INVALID", message: "한 줄에 놓을 팀원 수는 0~20명이에요." });
    }
    const { membersPerLine: _per, ...olderTeam } = teamSettings({ teams: twoTeams });
    expect(_per).toBe(0);
    expect(await m.saveTeamPrize(olderTeam)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.teamPrizeSettings.membersPerLine).toBe(0);
    // Another source keeps the CUSTOM teams but does not need them.
    expect(await m.saveTeamPrize(teamSettings({ source: "BROADCAST_TEAMS" }))).toEqual({ status: "SAVED" });

    const bad: [Partial<Record<keyof TeamPrizeSettings, unknown>>, string][] = [
      [{ title: "가".repeat(21) }, "제목"],
      [{ basis: "MONTH" }, "집계 기준"],
      [{ source: "AUTO" }, "팀 구성"],
      [{ teams: [] }, "2개 이상"],
      [{ teams: [twoTeams[0]] }, "2개 이상"],
      [{ teams: Array.from({ length: 9 }, (_, i) => ({ name: `팀${i}`, memberIds: [`cm-s${i}`] })) }, "8개까지"],
      [{ teams: [{ name: "가", memberIds: ["cm-s1"] }, { name: "가", memberIds: ["cm-s2"] }] }, "같은 이름"],
      [{ teams: [{ name: "가", memberIds: ["cm-s1"] }, { name: "나", memberIds: [] }] }, "나에 멤버"],
      [{ teams: [{ name: "가", memberIds: ["cm-s1"] }, { name: "나", memberIds: ["cm-s1"] }] }, "한 팀에만"],
      [{ teams: [{ name: "가", memberIds: ["cm-s1"] }, { name: "나", memberIds: ["cm-nobody"] }] }, "팀 배정"],
      [{ teams: [{ name: "가".repeat(11), memberIds: ["cm-s1"] }, { name: "나", memberIds: ["cm-s2"] }] }, "10자"],
      [{ teams: [{ name: "admin팀", memberIds: ["cm-s1"] }, { name: "나", memberIds: ["cm-s2"] }] }, "사용할 수 없는"],
      [{ teams: twoTeams, prizes: Array.from({ length: 9 }, () => ({ text: "x", color: null })) }, "8등"],
      [{ teams: twoTeams, prizes: [{ text: "상금", color: "red" }] }, "글자색"],
      [{ teams: twoTeams, members: "ALL" }, "팀원 표시"],
      [{ teams: twoTeams, columns: 4 }, "열 개수"],
      [{ teams: twoTeams, placement: "TOP" }, "배치"],
      [{ teams: twoTeams, showTotal: 1 }, "표시 설정"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveTeamPrize({ ...teamSettings(), ...patch });
      expect(res.status, message).toBe("INVALID");
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveTeamPrize(teamSettings({ teams: twoTeams }))).toEqual({ status: "UNAUTHORIZED" });
  });

  it("takes the teams from the source: set up here, the broadcast's A팀 · B팀 or the latest 다수 팀 배틀", async () => {
    const m = await load();
    const { startBattle } = await import("./crewBattle");
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    expect(await teamBoard(m)).toMatchObject({ rows: [], missing: "NO_TEAMS", visible: false });

    m.attributeMemberDonation("dn-1", "studio", "cm-s2", 3_000);
    await m.adjustScore({ broadcastId: id, memberId: "cm-s3", points: 5_000, adjustmentId: key(1) });
    await m.saveTeamPrize(teamSettings({ teams: twoTeams, prizes: [{ text: "회식", color: null }] }));
    const custom = await teamBoard(m);
    expect(teamLine(custom)).toEqual(["1 B팀 회식 5000 [바다 5000]", "2 불꽃 - 3000 [하늘 3000, 길동 0]"]);
    expect(custom).toMatchObject({ missing: null, total: 8_000 });
    expect(custom.rows.map((r) => r.color)).toEqual(["#ec4899", "#3b82f6"]); // colors follow the set-up order

    await m.saveTeamPrize(teamSettings({ source: "BROADCAST_TEAMS", teams: twoTeams }));
    expect(await teamBoard(m)).toMatchObject({ rows: [], missing: "NOT_TEAM_MODE" });

    await m.saveTeamPrize(teamSettings({ source: "BATTLE" }));
    expect(await teamBoard(m)).toMatchObject({ rows: [], missing: "NO_BATTLE" });
    const teams = [{ name: "용", memberIds: ["cm-s1"] }, { name: "범", memberIds: ["cm-s2", "cm-s3"] }];
    expect(await startBattle({ broadcastId: id, requestId: key(2), mode: "MULTI_TEAMS", teams, durationSec: 120 })).toEqual({ status: "SAVED" });
    // The board's own basis (방송 전체 점수 here), not the battle's score.
    expect(teamLine(await teamBoard(m))).toEqual(["1 범 - 8000 [바다 5000, 하늘 3000]", "2 용 - 0 [길동 0]"]);

    await m.endBroadcast(id);
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "팀전", teamMode: true, teams: { "cm-s1": "A", "cm-s2": "B", "cm-s3": "A" } });
    const teamId = (await m.getBroadcastView())!.live!.id;
    await m.adjustScore({ broadcastId: teamId, memberId: "cm-s2", points: 2_000, adjustmentId: key(3) });
    await m.saveTeamPrize(teamSettings({ source: "BROADCAST_TEAMS", members: "NONE", prizes: [{ text: "1등", color: null }, { text: "벌칙", color: null }] }));
    expect(teamLine(await teamBoard(m))).toEqual(["1 B팀 1등 2000 [하늘 2000]", "2 A팀 벌칙 0 [길동 0, 바다 0]"]);
  });

  it("counts its own 구간 on the window basis and is shown on OBS on its own", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    await m.saveTeamPrize(teamSettings({ basis: "WINDOW", teams: twoTeams }));
    await m.savePrizeBoard(settings({ basis: "WINDOW" }));
    expect((await m.startPrizeWindow({ broadcastId: id, requestId: key(1), board: "BOTH" })).status).toBe("INVALID");
    expect((await m.stopPrizeWindow({ broadcastId: id, board: "TEAM" })).status).toBe("INVALID"); // nothing to stop

    vi.setSystemTime(new Date("2026-10-25T12:01:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(10), amount: 1_000, message: "하늘" }); // before the 구간
    vi.setSystemTime(new Date("2026-10-25T12:02:00Z"));
    expect(await m.startPrizeWindow({ broadcastId: id, requestId: key(2), board: "TEAM" })).toEqual({ status: "SAVED" });
    vi.setSystemTime(new Date("2026-10-25T12:03:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(11), amount: 4_000, message: "하늘" });
    await m.startPrizeWindow({ broadcastId: id, requestId: key(2), board: "TEAM" }); // retried start: no restart
    const running = await teamBoard(m);
    expect(running.window).toEqual({ startedAt: "2026-10-25T12:02:00.000Z", stoppedAt: null });
    expect(teamLine(running)[0]).toBe("1 불꽃 - 4000 [하늘 4000, 길동 0]");
    // The 상품 순위표 keeps its own 구간 (not started).
    expect((await board(m)).window).toBeNull();

    expect(await m.setPrizeBoardVisible({ broadcastId: id, on: true, board: "TEAM" })).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && [overlay.teamPrize.visible, overlay.prizeBoard.visible]).toEqual([true, false]);

    vi.setSystemTime(new Date("2026-10-25T12:04:00Z"));
    await m.endBroadcast(id);
    const ended = (await import("./mockCrewStore")).mockCrew.broadcasts!.find((b) => b.id === id)!;
    expect(ended.teamPrize!.window!.stoppedAt).toBe("2026-10-25T12:04:00.000Z");

    signIn(["SUPPORTER"]);
    expect(await m.setPrizeBoardVisible({ broadcastId: id, on: false, board: "TEAM" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
