import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { rankItems } from "./voteTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 무료 투표 (2026-10-04 결정): the creator starts a 투표 위젯 preset from the 리모컨, each signed-in viewer
 * votes once in the room, and the 투표 overlay shows the counts. No FN moves.
 */
async function load() {
  const votes = await import("./votes");
  const core = await import("./voteCore");
  const remote = await import("@/services/creator/voteRemote");
  const widgets = await import("@/services/creator/widgetSettings");
  const overlay = await import("@/services/creator/widgetOverlay");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { STUDIO_CHANNEL } = await import("@/services/crew/mockCrewStore");
  return { ...votes, ...core, ...remote, ...widgets, ...overlay, overlayKey: mockCreator.integrationKey, account: mockAccount, STUDIO_CHANNEL };
}

type M = Awaited<ReturnType<typeof load>>;

/** Saves one ready preset (and one with a blank item) on the 투표 위젯. */
async function savePresets(m: M) {
  const detail = (await m.getWidgetDetail("VOTE"))!;
  const settings = detail.settings as { presets: unknown[] };
  const presets = [
    { id: "preset-1", name: "", color: "#28BA93", durationSec: 600, items: ["떡볶이", "치킨", "  "] },
    { id: "preset-2", name: "빈 투표", color: "#3B82F6", durationSec: 300, items: ["하나", ""] }
  ];
  expect(await m.saveWidgetSettings("VOTE", { ...settings, presets })).toEqual({ status: "SAVED" });
}

const overlayVote = async (m: M) => {
  const o = await m.getOverlayWidget("vote", m.overlayKey);
  if (o === "FORBIDDEN" || o.widget !== "vote") throw new Error("vote overlay");
  return o.vote;
};

describe("무료 투표", () => {
  beforeEach(() => resetMockStores());

  it("has no FN price or 무료 투표권 on presets, including ones saved before the decision", async () => {
    const m = await load();
    const { widgetStore } = await import("@/services/creator/widgetStore");
    widgetStore.VOTE.presets = [{ ...widgetStore.VOTE.presets[0], pricePerVote: 1_000, freeVotes: 3 } as (typeof widgetStore.VOTE.presets)[number]];
    const preset = ((await m.getWidgetDetail("VOTE"))!.settings as { presets: Record<string, unknown>[] }).presets[0];
    expect(Object.keys(preset).sort()).toEqual(["color", "durationSec", "id", "items", "name"]);
  });

  it("starts a ready preset once from the 리모컨, shows it on the overlay, and needs it ended before the next", async () => {
    const m = await load();
    await savePresets(m);
    signIn(["SUPPORTER"]);
    expect(await m.startVote({ presetId: "preset-1", requestId: key(1) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getVoteRemote()).toBeNull();
    signIn();

    expect(await overlayVote(m)).toBeNull();
    expect((await m.startVote({ presetId: "preset-2", requestId: key(2) })).status).toBe("INVALID"); // one filled item
    expect((await m.startVote({ presetId: "nope", requestId: key(3) })).status).toBe("INVALID");
    expect((await m.startVote({ presetId: "preset-1", requestId: "short" })).status).toBe("INVALID");

    expect(await m.startVote({ presetId: "preset-1", requestId: key(4) })).toEqual({ status: "SAVED" });
    // A retried request is a no-op; another start while it runs is refused.
    expect(await m.startVote({ presetId: "preset-1", requestId: key(4) })).toEqual({ status: "SAVED" });
    expect(await m.startVote({ presetId: "preset-1", requestId: key(5) })).toEqual({ status: "INVALID", message: "진행 중인 투표를 먼저 종료해 주세요." });
    expect(m.mockVotes.runs.filter((r) => r.channelId === m.STUDIO_CHANNEL)).toHaveLength(1);

    const view = (await m.getVoteRemote())!;
    expect(view.presets.map((p) => [p.label, p.ready, p.items])).toEqual([
      ["1번 투표", true, ["떡볶이", "치킨"]],
      ["빈 투표", false, ["하나"]]
    ]);
    const board = (await overlayVote(m))!;
    expect(board).toMatchObject({ name: "1번 투표", color: "#28BA93", total: 0, ended: false, items: [{ label: "떡볶이", count: 0 }, { label: "치킨", count: 0 }] });
    expect(Date.parse(board.endsAt) - Date.parse(board.startedAt)).toBe(600_000);
    expect(view.board?.id).toBe(board.id);
  });

  it("takes one free ballot per member in the room and never moves FN", async () => {
    const m = await load();
    await savePresets(m);
    await m.startVote({ presetId: "preset-1", requestId: key(1) });
    const voteId = (await overlayVote(m))!.id;
    const balance = m.account.fnBalance;

    signIn(null);
    expect(await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId, item: 0 })).toEqual({ status: "UNAUTHORIZED" });
    expect((await m.getRoomVote(m.STUDIO_CHANNEL))!.myChoice).toBeNull(); // reading is public
    signIn(["SUPPORTER"]);

    expect((await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId, item: 5 })).status).toBe("INVALID");
    expect(await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId: "vote-old", item: 0 })).toEqual({ status: "NOT_FOUND" });
    const first = await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId, item: 1 });
    expect(first.status).toBe("VOTED");
    // The same ballot again (a retry) is not counted twice; another choice is refused.
    const again = await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId, item: 1 });
    expect(again.status === "VOTED" && again.vote).toMatchObject({ total: 1, myChoice: 1 });
    const other = await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId, item: 0 });
    expect(other.status === "ALREADY_VOTED" && other.vote.items.map((i) => i.count)).toEqual([0, 1]);

    // Other members (core): counts and the competition ranking on the overlay.
    const run = m.currentRun(m.STUDIO_CHANNEL)!;
    expect(m.castBallot(run, "member-2", 0)).toBe("VOTED");
    expect((await overlayVote(m))!.total).toBe(2);
    expect(rankItems((await overlayVote(m))!).map((i) => [i.rank, i.label])).toEqual([
      [1, "떡볶이"],
      [1, "치킨"]
    ]);
    expect(m.account.fnBalance).toBe(balance);
  });

  it("ends early or at its time limit, then comes off the screen with 결과 내리기", async () => {
    const m = await load();
    await savePresets(m);
    await m.startVote({ presetId: "preset-1", requestId: key(1) });
    const run = m.currentRun(m.STUDIO_CHANNEL)!;
    // Past the time limit no ballot is recorded.
    expect(m.castBallot(run, "late-member", 0, Date.parse(run.endsAt) + 1)).toBe("ENDED");

    expect((await m.closeVote({ voteId: run.id })).status).toBe("INVALID"); // still running
    expect(await m.endVote({ voteId: run.id })).toEqual({ status: "SAVED" });
    expect(await m.endVote({ voteId: run.id })).toEqual({ status: "SAVED" });
    const ended = await m.castVote({ channelId: m.STUDIO_CHANNEL, voteId: run.id, item: 0 });
    expect(ended.status === "ENDED" && ended.vote.ended).toBe(true);
    expect((await overlayVote(m))!.ended).toBe(true);

    // A new vote replaces the ended result.
    expect(await m.startVote({ presetId: "preset-1", requestId: key(2) })).toEqual({ status: "SAVED" });
    expect((await overlayVote(m))!.id).not.toBe(run.id);
    const next = m.currentRun(m.STUDIO_CHANNEL)!;
    await m.endVote({ voteId: next.id });
    expect(await m.closeVote({ voteId: next.id })).toEqual({ status: "SAVED" });
    expect(await overlayVote(m)).toBeNull();
    expect(await m.getRoomVote(m.STUDIO_CHANNEL)).toBeNull();
    expect((await m.getVoteRemote())!.board).toBeNull();
  });

  it("shows the seeded vote in a live creator room", async () => {
    const m = await load();
    const vote = (await m.getRoomVote("c1"))!;
    expect(vote).toMatchObject({ name: "방송 끝나고 뭐 할까요?", total: 29, ended: false, myChoice: null });
    expect(vote.items.map((i) => i.count)).toEqual([14, 9, 6]);
    expect(await m.getRoomVote("c2")).toBeNull();
    expect(await m.getRoomVote("../bad")).toBeNull();
  });
});
