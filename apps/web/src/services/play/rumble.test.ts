import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import type { Platform } from "@/types/platform";
import { knockoutTimes } from "./rumbleCore";
import { DEFAULT_RUMBLE, RUMBLE_SUDDEN_AT, rumbleRing, rumbleStandings, type RumbleBattle, type RumbleSettings } from "./rumbleTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 로얄 럼블 (2026-10-24, StreamDonate 로얄 럼블 참고) — P2 시청자 참여 게임. */
async function load() {
  const rumble = await import("./rumble");
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
  const view = async () => (await rumble.getRumbleView())!;
  const open = async (requestId = key(1)) => {
    expect(await rumble.openRumble({ requestId })).toEqual({ status: "SAVED" });
    return (await view()).round!.id;
  };
  const add = async (roundId: string, ...names: string[]) => {
    for (const name of names) expect(await rumble.addRumble({ roundId, name })).toEqual({ status: "SAVED" });
  };
  return { ...rumble, chat, view, open, add, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const settings = (patch: Partial<RumbleSettings> = {}) => ({ ...DEFAULT_RUMBLE, ...patch });

/** Who is still standing just before each knockout, by its killer: someone in, never the one knocked out. */
function expectFairFight(battle: RumbleBattle) {
  const standing = new Set(battle.fighters.map((f) => f.id));
  for (const k of battle.knockouts) {
    expect(standing.has(k.victimId)).toBe(true);
    standing.delete(k.victimId);
    if (k.killerId) expect(standing.has(k.killerId)).toBe(true);
  }
  expect([...standing]).toEqual([battle.winnerId]);
}

describe("로얄 럼블 링 · 탈락 시간", () => {
  it("closes the ring in two steps (링 축소) and squeezes it in 서든데스", () => {
    expect(rumbleRing(0, 40, true, true)).toBe(1);
    expect(rumbleRing(12, 40, true, true)).toBeCloseTo(0.8);
    expect(rumbleRing(30, 40, true, true)).toBeCloseTo(0.62);
    expect(rumbleRing(32, 40, true, true)).toBeCloseTo(0.62);
    expect(rumbleRing(40, 40, true, true)).toBeCloseTo(0.22);
    expect(rumbleRing(36, 40, true, true)).toBeLessThan(0.62);
    expect(rumbleRing(30, 40, false, false)).toBe(1);
    expect(rumbleRing(40, 40, false, true)).toBeCloseTo(0.22);
    expect(rumbleRing(31, 40, false, true)).toBe(1);
  });

  it("spreads the knockouts over the fight, the last one ending it (서든데스: the last few after it starts)", () => {
    for (let run = 0; run < 20; run++) {
      for (const [count, sec] of [
        [1, 20],
        [2, 20],
        [9, 45],
        [49, 20],
        [49, 120]
      ]) {
        for (const sudden of [false, true]) {
          const t = knockoutTimes(count, sec, sudden);
          expect(t).toHaveLength(count);
          expect(t.at(-1)).toBe(sec);
          t.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(t[i]));
          expect(t[0]).toBeGreaterThan(0);
          if (sudden) {
            const late = Math.min(count, Math.max(1, Math.round((count + 1) * 0.15)));
            t.slice(0, count - late).forEach((x) => expect(x).toBeLessThan(sec * RUMBLE_SUDDEN_AT));
            t.slice(count - late).forEach((x) => expect(x).toBeGreaterThan(sec * RUMBLE_SUDDEN_AT));
          }
        }
      }
    }
  });
});

describe("로얄 럼블", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect((await m.view()).settings).toEqual(DEFAULT_RUMBLE);
    expect(await m.saveRumble(settings({ title: " 오늘의 럼블 ", keyword: "!fight", maxPlayers: 20, fillTo: 0, battleSec: 90, ringShrink: false, suddenDeath: false }))).toEqual({ status: "SAVED" });
    expect((await m.view()).settings).toEqual({ title: "오늘의 럼블", keyword: "!fight", maxPlayers: 20, fillTo: 0, battleSec: 90, ringShrink: false, suddenDeath: false });
    for (const [patch, message] of [
      [{ title: "가".repeat(21) }, "제목은 20자 이내로 입력해 주세요."],
      [{ keyword: "! 참여" }, "참가 명령어는 띄어쓰기 없이 1~10자로 입력해 주세요."],
      [{ keyword: "admin" }, "사용할 수 없는 단어가 포함되어 있어요."],
      [{ maxPlayers: 1 }, "최대 인원은 2 ~ 50명이에요."],
      [{ fillTo: 31 }, "봇 채우기는 0 ~ 30명이에요."],
      [{ battleSec: 19 }, "배틀 시간은 20 ~ 120초예요."],
      [{ ringShrink: "yes" }, "설정을 확인해 주세요."]
    ] as const) {
      expect(await m.saveRumble(settings(patch as Partial<RumbleSettings>))).toEqual({ status: "INVALID", message });
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveRumble(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("takes chat entries by keyword once per platform user, up to the 최대 인원", async () => {
    const m = await load();
    await m.saveRumble(settings({ maxPlayers: 3 }));
    m.chat("YOUTUBE", "early", "미리", "!참여"); // before the round
    const roundId = await m.open();
    m.chat("YOUTUBE", "u1", "하나", "!참여");
    m.chat("YOUTUBE", "u1", "하나", "!참여 또"); // same viewer
    m.chat("CHZZK", "u1", "치지직하나", "!참여 할래요");
    m.chat("SOOP", "u2", "숨김", "!참여", { hidden: "MANUAL" });
    m.chat("SOOP", "u3", "스튜디오", "!참여", { fromStudio: true });
    m.chat("SOOP", "u4", "구경", "!참여하기"); // not the keyword
    m.chat("FLEXTV", "u5", "셋", "!참여");
    m.chat("FLEXTV", "u6", "넷", "!참여"); // full
    expect((await m.view()).round!.entrants.map((e) => `${e.name}@${e.source}`)).toEqual(["하나@YOUTUBE", "치지직하나@CHZZK", "셋@FLEXTV"]);
    expect(await m.addRumble({ roundId, name: "더" })).toEqual({ status: "INVALID", message: "참가 인원이 다 찼어요." });
  });

  it("fills the ring with 봇, decides the fight on the server and keeps the 회차 결과", async () => {
    const m = await load();
    await m.saveRumble(settings({ fillTo: 6, battleSec: 30 }));
    const roundId = await m.open();
    await m.add(roundId, "가");
    expect(await m.addRumble({ roundId, name: "가" })).toEqual({ status: "INVALID", message: "이미 참가한 이름이에요." });
    expect(await m.startRumble({ roundId, requestId: key(2) })).toEqual({ status: "INVALID", message: "참가자가 2명 이상이어야 시작할 수 있어요." });
    await m.add(roundId, "나", "다");
    await m.saveRumble(settings({ fillTo: 0, battleSec: 60, ringShrink: false, suddenDeath: false })); // for the next round only

    expect(await m.startRumble({ roundId, requestId: key(3) })).toEqual({ status: "SAVED" });
    expect(await m.startRumble({ roundId, requestId: key(3) })).toEqual({ status: "SAVED" }); // retried: same battle
    expect(await m.startRumble({ roundId, requestId: key(4) })).toEqual({ status: "INVALID", message: "이미 배틀을 시작했어요." });
    const round = (await m.view()).round!;
    const battle = round.battle!;
    expect(round.status).toBe("FIGHTING");
    expect(battle.fighters.map((f) => `${f.name}${f.bot ? "🤖" : ""}`)).toEqual(["가", "나", "다", "봇 1🤖", "봇 2🤖", "봇 3🤖"]);
    expect(battle.fighters.find((f) => f.id === battle.winnerId)!.bot).toBe(false);
    expect(battle).toMatchObject({ ringShrink: true, suddenDeath: true, startAt: new Date(T0.getTime() + 3_000).toISOString(), endAt: new Date(T0.getTime() + 33_000).toISOString() });
    expect(battle.knockouts).toHaveLength(5);
    expect(battle.knockouts.at(-1)!.at).toBe(30);
    expectFairFight(battle);
    expect(await m.addRumble({ roundId, name: "라" })).toEqual({ status: "INVALID", message: "참가 모집 중인 판이 아니에요." });
    expect(await m.openRumble({ requestId: key(5) })).toEqual({ status: "INVALID", message: "배틀이 끝난 뒤에 새 판을 열어 주세요." });
    expect(await m.closeRumble({ roundId })).toEqual({ status: "INVALID", message: "배틀이 끝난 뒤에 닫을 수 있어요." });
    expect((await m.view()).history).toEqual([]); // not over yet

    vi.setSystemTime(T0.getTime() + 33_000);
    expect((await m.view()).round!.status).toBe("DONE");
    const table = rumbleStandings(battle);
    expect(table.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(table[0].id).toBe(battle.winnerId);
    expect(table[1].id).toBe(battle.knockouts.at(-1)!.victimId);
    expect(table.reduce((sum, s) => sum + s.kills, 0)).toBe(battle.knockouts.filter((k) => k.killerId).length);
    const top = [...table].sort((a, b) => b.kills - a.kills || a.rank - b.rank)[0];
    expect((await m.view()).history).toEqual([
      { no: 1, at: battle.endAt, players: 3, bots: 3, winner: table[0].name, kills: table[0].kills, topKiller: top.kills ? { name: top.name, kills: top.kills } : null }
    ]);
    expect(await m.openRumble({ requestId: key(6) })).toEqual({ status: "SAVED" });
    expect((await m.view()).round).toMatchObject({ no: 2, status: "OPEN", fillTo: 0, entrants: [] });
    expect(await m.closeRumble({ roundId: (await m.view()).round!.id })).toEqual({ status: "SAVED" });
    expect((await m.view()).round).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.startRumble({ roundId, requestId: key(7) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("never lets a 봇 win, and knocks out by the ring only after a 링 축소 or in 서든데스", async () => {
    const m = await load();
    for (const [i, [ringShrink, suddenDeath]] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true]
    ].entries()) {
      await m.saveRumble(settings({ fillTo: 30, battleSec: 20, ringShrink, suddenDeath }));
      for (let run = 0; run < 8; run++) {
        vi.setSystemTime(T0.getTime() + (i * 8 + run) * 60_000);
        const roundId = await m.open(key(100 + i * 8 + run));
        await m.add(roundId, "가", "나");
        expect(await m.startRumble({ roundId, requestId: key(200 + i * 8 + run) })).toEqual({ status: "SAVED" });
        const battle = (await m.view()).round!.battle!;
        expect(battle.fighters).toHaveLength(30);
        expect(["가", "나"]).toContain(battle.fighters.find((f) => f.id === battle.winnerId)!.name);
        expectFairFight(battle);
        for (const k of battle.knockouts.filter((x) => !x.killerId)) {
          const p = k.at / 20;
          expect((ringShrink && p > 0.25) || (suddenDeath && p > RUMBLE_SUDDEN_AT)).toBe(true);
        }
        vi.setSystemTime(Date.parse(battle.endAt));
      }
    }
    expect((await m.view()).history).toHaveLength(20);
  });

  it("shows the round on OBS by the integration key", async () => {
    const m = await load();
    expect(await m.getRumbleOverlay("nope")).toBe("FORBIDDEN");
    const empty = await m.getRumbleOverlay(m.overlayKey);
    expect(empty).toMatchObject({ title: "로얄 럼블", round: null, on: true });
    await m.saveRumble(settings({ title: "주말 럼블" }));
    const roundId = await m.open();
    m.chat("YOUTUBE", "u1", "하나", "!참여");
    const live = await m.getRumbleOverlay(m.overlayKey);
    expect(live).toMatchObject({ title: "주말 럼블", round: { id: roundId, status: "OPEN", entrants: [{ name: "하나", source: "YOUTUBE" }] } });
  });
});
