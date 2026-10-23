import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_PRIZE_BOARD, type PrizeBoardSettings } from "./crewTypes";

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
  });

  it("validates and saves the settings, trimming blank lines and colors without text", async () => {
    const m = await load();
    const ok = { ...settings(), title: " 식사대전 ", prizes: [{ text: "스테이크", color: "#FFAA00" }, { text: "", color: "#123456" }, { text: " ", color: null }] };
    expect(await m.savePrizeBoard(ok)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.prizeSettings).toMatchObject({ title: "식사대전", prizes: [{ text: "스테이크", color: "#ffaa00" }] });

    const bad: [Record<string, unknown>, string][] = [
      [{ title: "가".repeat(21) }, "제목"],
      [{ basis: "MONTH" }, "집계 기준"],
      [{ prizes: [{ text: "가".repeat(31), color: null }] }, "30자"],
      [{ prizes: [{ text: "상금", color: "red" }] }, "글자색"],
      [{ prizes: Array.from({ length: 31 }, () => ({ text: "x", color: null })) }, "30등"],
      [{ excluded: ["cm-nobody"] }, "뺄 멤버"],
      [{ excluded: ["cm-s1"], pinned: { memberId: "cm-s1", text: "" } }, "상단 고정"],
      [{ pinned: { memberId: "cm-s1", text: "운영자 고정" } }, "사용할 수 없는"],
      [{ columns: 4 }, "열 개수"],
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
