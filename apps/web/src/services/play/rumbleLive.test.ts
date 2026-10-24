import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { LIVE_ATTACK_COOLDOWN_MS, LIVE_HP } from "./rumbleLiveSim";
import { DEFAULT_LIVE, type LiveSettings } from "./rumbleLiveTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 로얄 럼블 (조작형) (2026-10-24, StreamDonate 참고) — P2 시청자 참여 게임. */
async function load() {
  const live = await import("./rumbleLive");
  const core = await import("./rumbleLiveCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const view = async () => (await live.getLiveView())!;
  const open = async () => {
    expect(await live.openLive({ requestId: key(1) })).toEqual({ status: "SAVED" });
    const round = (await view()).round!;
    return { round, token: round.invitePath.split("/").pop()! };
  };
  const join = async (token: string, name: string, n: number) => {
    const res = await live.joinLiveRound({ token, name, requestId: key(100 + n) });
    if (res.status !== "JOINED") throw new Error(res.message);
    return res;
  };
  return { ...live, ...core, view, open, join, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z").getTime();
const settings = (patch: Partial<LiveSettings> = {}) => ({ ...DEFAULT_LIVE, ...patch });

describe("로얄 럼블 (조작형)", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect((await m.view()).settings).toEqual(DEFAULT_LIVE);
    expect(await m.saveLive(settings({ title: " 대결 ", maxPlayers: 4, battleSec: 60, ringShrink: false }))).toEqual({ status: "SAVED" });
    expect((await m.view()).settings).toEqual({ title: "대결", maxPlayers: 4, battleSec: 60, ringShrink: false });
    for (const [patch, message] of [
      [{ title: "가".repeat(21) }, "제목은 20자 이내로 입력해 주세요."],
      [{ maxPlayers: 1 }, "최대 인원은 2 ~ 16명이에요."],
      [{ maxPlayers: 17 }, "최대 인원은 2 ~ 16명이에요."],
      [{ battleSec: 29 }, "배틀 시간은 30 ~ 180초예요."],
      [{ ringShrink: "yes" }, "설정을 확인해 주세요."]
    ] as const) {
      expect(await m.saveLive(settings(patch as Partial<LiveSettings>))).toEqual({ status: "INVALID", message });
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveLive(settings())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getLiveView()).toBeNull();
  });

  it("lets viewers join by the link with a name, once, up to the 최대 인원, and the creator remove them", async () => {
    const m = await load();
    await m.saveLive(settings({ maxPlayers: 2 }));
    const { round, token } = await m.open();
    expect(await m.getLiveInvite("nope")).toBeNull();
    expect(await m.getLiveInvite(token)).toEqual({ title: "로얄 럼블 (조작형)", phase: "OPEN", players: 0, maxPlayers: 2 });
    const a = await m.join(token, "하나", 1);
    expect(a).toMatchObject({ status: "JOINED", name: "하나" });
    // A retried join gets the same fighter and secret.
    expect(await m.joinLiveRound({ token, name: "하나", requestId: key(101) })).toEqual(a);
    expect(await m.joinLiveRound({ token, name: "하나", requestId: key(102) })).toEqual({ status: "INVALID", message: "이미 참가한 이름이에요." });
    expect(await m.joinLiveRound({ token, name: " ", requestId: key(103) })).toEqual({ status: "INVALID", message: "이름은 1~12자로 입력해 주세요." });
    expect(await m.joinLiveRound({ token: "nope", name: "둘", requestId: key(104) })).toEqual({ status: "INVALID", message: "참가 모집이 끝났거나 없는 링크예요." });
    const b = await m.join(token, "둘", 5);
    expect(await m.joinLiveRound({ token, name: "셋", requestId: key(106) })).toEqual({ status: "INVALID", message: "참가 인원이 다 찼어요." });
    expect((await m.view()).round!.players.map((p) => `${p.name}:${p.color}`)).toEqual(["하나:0", "둘:1"]);
    expect(await m.kickLivePlayer({ roundId: round.id, playerId: b.playerId })).toEqual({ status: "SAVED" });
    expect(m.inputLive({ token, playerId: b.playerId, secret: b.secret })).toBeNull(); // removed
    expect(m.inputLive({ token, playerId: a.playerId, secret: "wrong" })).toBeNull();
    expect(m.inputLive({ token, playerId: a.playerId, secret: a.secret })).toMatchObject({ phase: "OPEN", players: 1, me: { name: "하나", hp: LIVE_HP, alive: true, rank: null } });
  });

  it("counts down, fights with each player's own stick and attack, and keeps the 회차 결과", async () => {
    const m = await load();
    await m.saveLive(settings({ battleSec: 30 }));
    const { round, token } = await m.open();
    const a = await m.join(token, "하나", 1);
    expect(await m.startLiveBattle({ roundId: round.id, requestId: key(2) })).toEqual({ status: "INVALID", message: "참가자가 2명 이상이어야 시작할 수 있어요." });
    const b = await m.join(token, "둘", 2);
    expect(await m.startLiveBattle({ roundId: round.id, requestId: key(3) })).toEqual({ status: "SAVED" });
    expect(await m.startLiveBattle({ roundId: round.id, requestId: key(3) })).toEqual({ status: "SAVED" }); // retried
    expect(await m.startLiveBattle({ roundId: round.id, requestId: key(4) })).toEqual({ status: "INVALID", message: "이미 배틀을 시작했어요." });
    expect(await m.joinLiveRound({ token, name: "셋", requestId: key(105) })).toEqual({ status: "INVALID", message: "이미 배틀이 시작됐어요. 다음 판에 참가해 주세요." });
    expect(m.inputLive({ token, playerId: a.playerId, secret: a.secret, dx: 0, dy: 1 })).toMatchObject({ phase: "COUNTDOWN", startAt: new Date(T0 + 3000).toISOString() });
    expect(await m.closeLiveRound({ roundId: round.id })).toEqual({ status: "INVALID", message: "배틀이 끝난 뒤에 닫을 수 있어요." });

    // The fight: 하나 starts at the top, 둘 at the bottom; 하나 walks down to 둘.
    vi.setSystemTime(T0 + 3000);
    m.inputLive({ token, playerId: a.playerId, secret: a.secret, dx: 0, dy: 1 });
    vi.setSystemTime(T0 + 3000 + 3300);
    const obs = m.liveState({ reloadSeq: 0, on: true });
    expect(obs).toMatchObject({ phase: "FIGHTING", no: 1, battleSec: 30, standings: null });
    const [fa, fb] = obs.fighters;
    expect(Math.hypot(fa.x - fb.x, fa.y - fb.y)).toBeLessThan(0.16);
    m.inputLive({ token, playerId: a.playerId, secret: a.secret, dx: 0, dy: 0 });
    // Five hits, one per cooldown; each time 둘 has come back within reach (the push-back is in the simulation tests).
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + LIVE_ATTACK_COOLDOWN_MS + 50);
      m.advanceLive();
      const [sa, sb] = m.liveStore().round!.sim!.players;
      Object.assign(sb, { x: sa.x, y: sa.y + 0.05 });
      m.inputLive({ token, playerId: a.playerId, secret: a.secret, dx: 0, dy: 0, attack: true });
    }
    vi.setSystemTime(Date.now() + 200);
    const me = m.inputLive({ token, playerId: b.playerId, secret: b.secret })!;
    expect(me).toMatchObject({ phase: "DONE", winner: "하나", me: { name: "둘", alive: false, hp: 0, rank: 2 } });
    const done = m.liveState({ reloadSeq: 0, on: true });
    expect(done.standings!.map((s) => `${s.rank}:${s.name}:${s.kills}:${s.outBy ?? "-"}`)).toEqual(["1:하나:1:-", "2:둘:0:하나"]);
    expect(done.feed).toEqual(["⚔️ 하나 → 둘"]);
    expect((await m.view()).history).toEqual([{ no: 1, at: expect.any(String), players: 2, winner: "하나", kills: 1 }]);
    expect(await m.closeLiveRound({ roundId: round.id })).toEqual({ status: "SAVED" });
    expect((await m.view()).round).toBeNull();
  });

  it("shows OBS nothing to fight without a round, and refuses OBS reads with another key", async () => {
    const m = await load();
    expect(m.liveState({ reloadSeq: 0, on: true })).toMatchObject({ phase: "NONE", fighters: [], no: null });
    const route = await import("@/app/api/play/rumble-live/[key]/route");
    const bad = await route.GET(new Request("http://x/api"), { params: Promise.resolve({ key: "nope" }) });
    expect(bad.status).toBe(404);
    const ok = await route.GET(new Request("http://x/api"), { params: Promise.resolve({ key: m.overlayKey }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ phase: "NONE", on: true });
    const input = await import("@/app/api/play/rumble-live/input/route");
    const res = await input.POST(new Request("http://x/api", { method: "POST", body: JSON.stringify({ token: "x", playerId: "y", secret: "z" }) }));
    expect(res.status).toBe(404);
    expect((await input.POST(new Request("http://x/api", { method: "POST", body: "not json" }))).status).toBe(400);
  });
});
