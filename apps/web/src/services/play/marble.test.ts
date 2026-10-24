import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import type { Platform } from "@/types/platform";
import { DEFAULT_MARBLE, marbleProgress, type MarbleSettings } from "./marbleTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 마블 룰렛 (2026-10-24, StreamDonate 마블 룰렛 참고) — P2 시청자 참여 게임. */
async function load() {
  const marble = await import("./marble");
  const { chatStore } = await import("@/services/broadcast/chatCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  let n = 0;
  /** A viewer's chat line arriving in the 통합 채팅 feed. */
  const chat = (platform: Platform, userId: string, name: string, text: string, extra: { hidden?: "MANUAL"; fromStudio?: boolean } = {}) => {
    const s = chatStore();
    n += 1;
    s.seq += 1;
    s.messages.push({
      id: `${platform}:m${n}`,
      seq: s.seq,
      platform,
      externalMessageId: `m${n}`,
      author: { platformUserId: userId, displayName: name, roles: [] },
      text,
      sentAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      hidden: extra.hidden ?? null,
      fromStudio: extra.fromStudio ?? false
    });
  };
  const view = async () => (await marble.getMarbleView())!;
  const names = async () => (await view()).round!.entrants.map((e) => `${e.name}@${e.source}`);
  const open = async (requestId = key(1)) => {
    expect(await marble.openMarble({ requestId })).toEqual({ status: "SAVED" });
    return (await view()).round!.id;
  };
  return { ...marble, chat, view, names, open, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const settings = (patch: Partial<MarbleSettings> = {}) => ({ ...DEFAULT_MARBLE, ...patch });

describe("마블 룰렛 레이스 연출", () => {
  it("runs each marble from the top to the bottom, in exactly at its finish", () => {
    for (const skill of [null, { kind: "BOOST" as const, at: 0.4 }, { kind: "BACK" as const, at: 0.6 }, { kind: "WARP" as const, at: 0.3 }]) {
      expect(marbleProgress(0, 10, 3, skill)).toBe(0);
      expect(marbleProgress(10, 10, 3, skill)).toBe(1);
      for (let t = 0.5; t < 10; t += 0.5) {
        const p = marbleProgress(t, 10, 3, skill);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
    // The one in first is ahead of the last one most of the way.
    expect(marbleProgress(6, 8, 1, null)).toBeGreaterThan(marbleProgress(6, 12, 2, null));
  });
});

describe("마블 룰렛", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveMarble(settings({ title: " 오늘의 마블 ", mode: "INVITE", keyword: "!go", maxPlayers: 10, map: "SPIRAL", skills: false, winRule: "RANK", winRank: 3, raceSec: 30 }))).toEqual({
      status: "SAVED"
    });
    expect((await m.view()).settings).toEqual({ title: "오늘의 마블", mode: "INVITE", keyword: "!go", maxPlayers: 10, map: "SPIRAL", skills: false, winRule: "RANK", winRank: 3, raceSec: 30 });
    const bad: [Record<string, unknown>, string][] = [
      [{ title: "가".repeat(21) }, "제목은 20자"],
      [{ mode: "LINK" }, "설정을 확인"],
      [{ map: "MOON" }, "설정을 확인"],
      [{ winRule: "MIDDLE" }, "설정을 확인"],
      [{ skills: "yes" }, "설정을 확인"],
      [{ keyword: "" }, "참가 명령어는"],
      [{ keyword: "!참 여" }, "참가 명령어는"],
      [{ keyword: "!12345678901" }, "참가 명령어는"],
      [{ title: "운영자 룰렛" }, "사용할 수 없는 단어"],
      [{ maxPlayers: 3 }, "최대 인원은 4 ~ 50명"],
      [{ maxPlayers: 51 }, "최대 인원은"],
      [{ winRank: 0 }, "당첨 순위는 1 ~ 50등"],
      [{ raceSec: 9 }, "레이스 시간은 10 ~ 60초"],
      [{ raceSec: 61 }, "레이스 시간은"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveMarble(settings(patch as Partial<MarbleSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveMarble(settings())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getMarbleView()).toBeNull();
  });

  it("takes chat entries of the keyword since the round opened, once per viewer, up to the 최대 인원", async () => {
    const m = await load();
    await m.saveMarble(settings({ maxPlayers: 4 }));
    m.chat("YOUTUBE", "u0", "일찍온사람", "!참여"); // before the round
    await m.open();
    m.chat("YOUTUBE", "u1", "하나", "!참여");
    m.chat("YOUTUBE", "u1", "하나", "!참여"); // again
    m.chat("CHZZK", "u1", "하나둘", "!참여 저요!"); // same id, another platform
    m.chat("SOOP", "u3", "셋", "안녕하세요 !참여"); // not first
    m.chat("FLEXTV", "u4", "넷", "!참여", { hidden: "MANUAL" });
    m.chat("YOUTUBE", "me", "스튜디오", "!참여", { fromStudio: true });
    m.chat("SOOP", "u5", "다섯", "!참여");
    expect(await m.names()).toEqual(["하나@YOUTUBE", "하나둘@CHZZK", "다섯@SOOP"]);
    m.chat("FLEXTV", "u6", "여섯", "!참여");
    m.chat("FLEXTV", "u7", "일곱", "!참여"); // full
    expect(await m.names()).toEqual(["하나@YOUTUBE", "하나둘@CHZZK", "다섯@SOOP", "여섯@FLEXTV"]);
    expect((await m.view()).invitePath).toBeNull();
  });

  it("races the entrants in an order the server draws, with the winner by the 당첨 rule, and keeps the 회차 결과", async () => {
    const m = await load();
    await m.saveMarble(settings({ winRule: "LAST", raceSec: 20, skills: true }));
    const roundId = await m.open();
    await m.saveMarble(settings({ winRule: "FIRST", map: "SPIRAL", raceSec: 40, skills: false })); // for the next round only
    const add = (name: unknown) => m.addMarble({ roundId, name });
    for (const name of ["가", "나", "다"]) expect(await add(name)).toEqual({ status: "SAVED" });
    expect(await add("가")).toEqual({ status: "INVALID", message: "이미 참가한 이름이에요." });
    expect(await add(" ")).toEqual({ status: "INVALID", message: "이름은 1~20자로 입력해 주세요." });
    expect(await add("admin")).toEqual({ status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." });
    expect(await m.startMarble({ roundId, requestId: key(2) })).toEqual({ status: "INVALID", message: "참가자가 4명 이상이어야 시작할 수 있어요." });
    m.chat("YOUTUBE", "u1", "라", "!참여");
    await add("마");
    const gone = (await m.view()).round!.entrants.find((e) => e.name === "마")!;
    expect(await m.removeMarble({ roundId, entrantId: gone.id })).toEqual({ status: "SAVED" });

    expect(await m.startMarble({ roundId, requestId: key(3) })).toEqual({ status: "SAVED" });
    expect(await m.startMarble({ roundId, requestId: key(3) })).toEqual({ status: "SAVED" }); // retried: same race
    expect(await m.startMarble({ roundId, requestId: key(4) })).toEqual({ status: "INVALID", message: "이미 레이스를 시작했어요." });
    const round = (await m.view()).round!;
    const race = round.race!;
    expect(round).toMatchObject({ status: "RACING", rule: "꼴등" });
    expect([...race.order].sort()).toEqual(round.entrants.map((e) => e.id).sort());
    expect(round.entrants.map((e) => e.name)).toEqual(["가", "나", "다", "라"]);
    expect(race.winnerId).toBe(race.order[3]);
    expect([race.startAt, race.finishAt]).toEqual([new Date(T0.getTime() + 3_000).toISOString(), new Date(T0.getTime() + 23_000).toISOString()]);
    expect(race.skills).toHaveLength(1);
    expect(race.skills[0].at).toBeGreaterThanOrEqual(0.2);
    expect(await add("바")).toEqual({ status: "INVALID", message: "참가 모집 중인 판이 아니에요." });
    expect(await m.openMarble({ requestId: key(5) })).toEqual({ status: "INVALID", message: "레이스가 끝난 뒤에 새 판을 열어 주세요." });
    expect(await m.closeMarble({ roundId })).toEqual({ status: "INVALID", message: "레이스가 끝난 뒤에 닫을 수 있어요." });
    expect((await m.view()).history).toEqual([]); // not over yet

    vi.setSystemTime(T0.getTime() + 23_000);
    expect((await m.view()).round!.status).toBe("DONE");
    const winner = round.entrants.find((e) => e.id === race.winnerId)!.name;
    expect((await m.view()).history).toEqual([{ no: 1, at: race.finishAt, players: 4, map: "PINS", rule: "꼴등", winner }]);
    expect(await m.openMarble({ requestId: key(6) })).toEqual({ status: "SAVED" });
    expect((await m.view()).round).toMatchObject({ no: 2, status: "OPEN", entrants: [] });
    expect(await m.closeMarble({ roundId: (await m.view()).round!.id })).toEqual({ status: "SAVED" });
    expect((await m.view()).round).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.startMarble({ roundId, requestId: key(7) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("VIP 초대 링크: viewers join by name with the link; the token stays off OBS", async () => {
    const m = await load();
    await m.saveMarble(settings({ mode: "INVITE", maxPlayers: 4, winRule: "RANK", winRank: 9 }));
    await m.open();
    const path = (await m.view()).invitePath!;
    const token = path.replace("/play/marble/", "");
    expect(path).toMatch(/^\/play\/marble\/[A-Za-z0-9_-]{24}$/);
    expect(await m.getMarbleInvite(token)).toEqual({ title: "마블 룰렛", open: true, players: 0, maxPlayers: 4 });
    expect(await m.getMarbleInvite("wrong-token")).toBeNull();
    expect(await m.joinMarble({ token, name: "초대1", requestId: key(1) })).toEqual({ status: "JOINED", players: 1 });
    expect(await m.joinMarble({ token, name: "초대1", requestId: key(1) })).toEqual({ status: "JOINED", players: 1 }); // retried
    expect(await m.joinMarble({ token, name: "초대1", requestId: key(2) })).toEqual({ status: "INVALID", message: "이미 참가한 이름이에요." });
    expect(await m.joinMarble({ token: "wrong-token", name: "x", requestId: key(3) })).toEqual({ status: "INVALID", message: "참가 모집이 끝났거나 없는 링크예요." });
    m.chat("YOUTUBE", "u1", "채팅", "!참여"); // INVITE: chat does not join
    for (const [i, name] of ["초대2", "초대3", "초대4"].entries()) await m.joinMarble({ token, name, requestId: key(10 + i) });
    expect(await m.joinMarble({ token, name: "초대5", requestId: key(20) })).toEqual({ status: "INVALID", message: "참가 인원이 다 찼어요." });
    expect(await m.names()).toEqual(["초대1@INVITE", "초대2@INVITE", "초대3@INVITE", "초대4@INVITE"]);

    const overlay = await m.getMarbleOverlay(m.overlayKey);
    expect(overlay).toMatchObject({ title: "마블 룰렛", round: { mode: "INVITE", status: "OPEN" }, on: true });
    expect(JSON.stringify(overlay)).not.toContain(token);
    expect(await m.getMarbleOverlay("nope")).toBe("FORBIDDEN");
    // RANK past the last: the last one wins.
    const roundId = (await m.view()).round!.id;
    await m.startMarble({ roundId, requestId: key(30) });
    const race = (await m.view()).round!.race!;
    expect(race.winnerId).toBe(race.order[3]);
    expect(await m.getMarbleInvite(token)).toBeNull(); // the link closes with the race
  });
});
