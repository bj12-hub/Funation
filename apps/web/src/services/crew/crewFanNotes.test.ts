import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 팬 메시지 · 요청사항 (code-first, 2026-10-06): room → operator, with a cooldown and 완료 · 숨기기. */
async function load() {
  const notes = await import("./crewFanNotes");
  const bc = await import("./crewBroadcast");
  const { STUDIO_CHANNEL } = await import("./mockCrewStore");
  return { ...notes, ...bc, CH: STUDIO_CHANNEL };
}

const T0 = new Date("2026-10-06T12:00:00Z").getTime();

describe("팬 메시지 · 요청사항", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  async function live(m: Awaited<ReturnType<typeof load>>) {
    expect(await m.startBroadcast({ title: "팬 메시지 방송", teamMode: false, teams: {} })).toEqual({ status: "SAVED" });
    return (await m.getBroadcastView())!.live!.id;
  }

  it("shows the room card only while a broadcast is live and 받기 is on", async () => {
    const m = await load();
    expect(await m.getRoomFanNotes(m.CH)).toBeNull();
    const id = await live(m);
    const room = (await m.getRoomFanNotes(m.CH))!;
    expect(room).toMatchObject({ broadcastId: id, title: "팬 메시지 방송", cooldownLeft: 0, mine: [] });
    expect(room.members.map((x) => x.name)).toEqual(["길동", "하늘", "바다"]); // 솔 is inactive
    expect(await m.getRoomFanNotes("c1")).toBeNull();
    // The c4 room starts with a live demo broadcast and its own crew.
    expect((await m.getRoomFanNotes("c4"))!.members.map((x) => x.id)).toEqual(["cm-c4-1", "cm-c4-2", "cm-c4-3"]);
    expect(await m.setFanNotesOpen({ broadcastId: id, on: false })).toEqual({ status: "SAVED" });
    expect(await m.getRoomFanNotes(m.CH)).toBeNull();
    expect(await m.sendFanNote({ channelId: m.CH, broadcastId: id, kind: "MESSAGE", memberId: null, text: "안녕", requestId: key(1) })).toEqual({ status: "CLOSED" });
    expect((await m.getBroadcastView())!.live!.fanNotes.open).toBe(false);
  });

  it("delivers a note to the operator once per request id, then waits out the cooldown", async () => {
    const m = await load();
    const id = await live(m);
    const note = { channelId: m.CH, broadcastId: id, kind: "REQUEST", memberId: "cm-s2", text: "  노래   한 곡\n부탁해요 ", requestId: key(1) };
    const sent = await m.sendFanNote(note);
    expect(sent).toMatchObject({ status: "SENT", room: { cooldownLeft: 30, mine: [{ kind: "REQUEST", memberName: "하늘", text: "노래 한 곡 부탁해요", done: false }] } });
    expect(await m.sendFanNote(note)).toEqual(sent);
    expect(await m.sendFanNote({ ...note, requestId: key(2) })).toEqual({ status: "COOLDOWN", seconds: 30 });
    vi.setSystemTime(T0 + 30_000);
    expect((await m.sendFanNote({ ...note, kind: "MESSAGE", memberId: null, text: "응원해요", requestId: key(3) })).status).toBe("SENT");

    const view = (await m.getBroadcastView())!.live!.fanNotes;
    expect(view.counts).toEqual({ NEW: 2, DONE: 0, HIDDEN: 0 });
    expect(view.notes.map((n) => [n.kind, n.memberName, n.author, n.text])).toEqual([
      ["MESSAGE", null, "홍길동", "응원해요"],
      ["REQUEST", "하늘", "홍길동", "노래 한 곡 부탁해요"]
    ]);
    expect(view.notes[0]).not.toHaveProperty("userId");

    // 완료 shows to the sender; 숨기기 does not.
    const [msg, req] = view.notes;
    expect(await m.setFanNoteStatus({ broadcastId: id, id: req.id, status: "DONE" })).toEqual({ status: "SAVED" });
    expect(await m.setFanNoteStatus({ broadcastId: id, id: msg.id, status: "HIDDEN" })).toEqual({ status: "SAVED" });
    expect((await m.getRoomFanNotes(m.CH))!.mine.map((n) => n.done)).toEqual([false, true]);
    expect((await m.getBroadcastView())!.live!.fanNotes.counts).toEqual({ NEW: 0, DONE: 1, HIDDEN: 1 });
  });

  it("uses the channel's 도배 기준, which the creator can change", async () => {
    const m = await load();
    const id = await live(m);
    expect((await m.getRoomFanNotes(m.CH))!.cooldownSec).toBe(30);
    expect((await m.getBroadcastView())!.live!.fanNotes.rules).toEqual({ cooldownSec: 30, perBroadcast: 500 });
    for (const bad of [{ cooldownSec: -1, perBroadcast: 100 }, { cooldownSec: 301, perBroadcast: 100 }, { cooldownSec: 1.5, perBroadcast: 100 }, { cooldownSec: 10, perBroadcast: 9 }, { cooldownSec: 10, perBroadcast: 501 }, { cooldownSec: "10", perBroadcast: 100 }]) {
      expect((await m.saveFanNoteRules(bad)).status).toBe("INVALID");
    }
    // No wait, and at most 10 notes this broadcast.
    expect(await m.saveFanNoteRules({ cooldownSec: 0, perBroadcast: 10 })).toEqual({ status: "SAVED" });
    expect((await m.getRoomFanNotes(m.CH))!.cooldownSec).toBe(0);
    const note = (n: number) => ({ channelId: m.CH, broadcastId: id, kind: "MESSAGE", memberId: null, text: `응원 ${n}`, requestId: key(40 + n) });
    for (let n = 0; n < 10; n++) expect((await m.sendFanNote(note(n))).status).toBe("SENT");
    expect(await m.sendFanNote(note(10))).toMatchObject({ status: "INVALID", message: "이번 방송에 받을 수 있는 메시지가 모두 찼어요." });
    expect((await m.simulateFanNote({ broadcastId: id, kind: "REQUEST", requestId: key(60) })).status).toBe("INVALID");
    // A longer wait applies to the next note at once.
    await m.saveFanNoteRules({ cooldownSec: 120, perBroadcast: 500 });
    expect(await m.sendFanNote(note(11))).toEqual({ status: "COOLDOWN", seconds: 120 });
    signIn(["SUPPORTER"]);
    expect(await m.saveFanNoteRules({ cooldownSec: 0, perBroadcast: 500 })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("validates notes and keeps operator actions to the creator", async () => {
    const m = await load();
    const id = await live(m);
    const base = { channelId: m.CH, broadcastId: id, kind: "MESSAGE", memberId: null, text: "응원해요" };
    for (const [n, bad] of [
      { kind: "GIFT" },
      { memberId: "cm-s4" }, // inactive
      { memberId: "cm-c4-1" }, // another channel's member
      { text: "   " },
      { text: "가".repeat(101) },
      { text: "운영자입니다" }
    ].entries()) {
      expect((await m.sendFanNote({ ...base, ...bad, requestId: key(10 + n) })).status).toBe("INVALID");
    }
    expect(await m.sendFanNote({ ...base, broadcastId: "old", requestId: key(20) })).toEqual({ status: "CLOSED" });
    expect((await m.setFanNoteStatus({ broadcastId: id, id: "nope", status: "DONE" })).status).toBe("INVALID");
    expect((await m.sendFanNote({ ...base, requestId: key(21) })).status).toBe("SENT");
    const note = (await m.getBroadcastView())!.live!.fanNotes.notes[0];
    expect((await m.setFanNoteStatus({ broadcastId: id, id: note.id, status: "GONE" })).status).toBe("INVALID");

    // 테스트 메시지: once per request id, never on cooldown.
    expect(await m.simulateFanNote({ broadcastId: id, kind: "REQUEST", requestId: key(30) })).toEqual({ status: "SAVED" });
    expect(await m.simulateFanNote({ broadcastId: id, kind: "REQUEST", requestId: key(30) })).toEqual({ status: "SAVED" });
    expect((await m.simulateFanNote({ broadcastId: id, kind: "GIFT", requestId: key(31) })).status).toBe("INVALID");
    expect((await m.getBroadcastView())!.live!.fanNotes.notes.map((n) => [n.author, n.kind])).toEqual([
      ["테스트 시청자", "REQUEST"],
      ["홍길동", "MESSAGE"]
    ]);

    signIn(["SUPPORTER"]);
    expect(await m.simulateFanNote({ broadcastId: id, kind: "MESSAGE", requestId: key(32) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.setFanNoteStatus({ broadcastId: id, id: note.id, status: "DONE" })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.setFanNotesOpen({ broadcastId: id, on: false })).toEqual({ status: "UNAUTHORIZED" });
    signIn(null);
    expect(await m.sendFanNote({ ...base, requestId: key(22) })).toEqual({ status: "UNAUTHORIZED" });
    expect((await m.getRoomFanNotes(m.CH))!.cooldownLeft).toBe(0); // reading is public
  });
});
