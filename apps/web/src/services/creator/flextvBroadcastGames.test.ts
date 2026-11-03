import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 6, second half: Ssumnation's 퀘스트 decisions, 리모컨, OBS overlays and 후원 내역 delegating to FLEXTV's
 * Ssumnation endpoints (FLEXTV_SSUMNATION_API on), against a stubbed FLEXTV API.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({
  FLEXTV_BACKEND: true,
  FLEXTV_AUTH: true,
  FLEXTV_WALLET: true,
  FLEXTV_DONATION: true,
  FLEXTV_LIVE: true,
  FLEXTV_STUDIO: true,
  FLEXTV_SSUMNATION_API: true,
  FLEXTV_WEB_URL: "https://www.flextv.test"
}));
const member = { creator: true };
vi.mock("@/lib/session", () => {
  const session = () => ({ userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: member.creator ? ["SUPPORTER", "CREATOR"] : ["SUPPORTER"] });
  return {
    getSession: async () => session(),
    getCreatorSession: async () => (member.creator ? session() : null),
    getFlextvAccessToken: async () => "member-token",
    hasRole: (s: { roles: string[] } | null, role: string) => !!s && s.roles.includes(role)
  };
});

type Call = { path: string; method: string; body: Record<string, unknown> | null; query: string };
let calls: Call[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const quest = { id: "q7", donorNickname: "열혈시청자", title: "노래 한 곡", amount: 3000, status: "IN_PROGRESS", createdAt: "2026-10-25T01:00:00Z", decidedAt: null, endsAt: "2026-10-25T02:00:00Z", extendedMin: 0, creatorDecides: false };

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  member.creator = true;
  calls = [];
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvOverlayDesigns;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: u.pathname, method: init.method ?? "GET", body, query: u.search });
      const p = u.pathname;
      if (p === "/api/ssumnation/quests/q7/decision") return body.decision === "SUCCESS" ? json({ status: "FORBIDDEN" }, 403) : json({ status: "OK", questStatus: body.decision, refundedAmount: 3000 });
      if (p === "/api/ssumnation/quests/q7/extension") return json({ status: "OK", minutes: body.minutes, endsAt: "2026-10-25T02:10:00Z", restarted: false });
      if (p === "/api/ssumnation/my/channel/quests") return json({ data: [quest], count: 1, held: { amount: 3000, count: 1 }, allowExtension: true, serverNow: "2026-10-25T01:20:00Z" });
      if (p === "/api/ssumnation/my/games/roulette" && init.method === "POST") return body.action === "START_NEXT" ? json({ status: "INVALID", message: "대기 중인 참여가 없어요." }, 400) : json({ status: "SAVED" });
      if (p === "/api/ssumnation/my/games/roulette") return json({ enabled: true, autoStart: false, autoReveal: true, paused: false, hidden: false, dailyLimit: 3, items: [], stage: null, queue: [], recent: [], participantsToday: 0 });
      if (p === "/api/ssumnation/my/games/gacha" && init.method === "POST") return json({ status: "SAVED" });
      if (p === "/api/ssumnation/my/games/gacha") return json({ stage: null, queue: [], recent: [], unclaimed: 0, hidden: false });
      if (p === "/api/ssumnation/my/overlay-key") return json({ key: init.method === "POST" ? "new-overlay-key-0000" : "overlay-key-00000000" });
      if (p === "/api/ssumnation/overlay/overlay-key-00000000/quest") return json({ quests: [{ id: "q7", title: "노래 한 곡", amount: 3000, endsAt: "2026-10-25T02:00:00Z", extendedMin: 0 }] });
      if (p === "/api/ssumnation/overlay/overlay-key-00000000/design") return json({ design: { version: 1, appearance: { theme: "BOLD", accent: "#ff3366" }, quest: { theme: "INHERIT", enabled: true, style: "SIMPLE", maxCount: 1 } } });
      if (p.startsWith("/api/ssumnation/overlay/")) return json({ status: "NOT_FOUND" }, 404);
      if (p === "/api/ssumnation/my/donations")
        return json({
          data:
            u.searchParams.get("category") === "quest"
              ? [{ id: 88812, donatedAt: "2026-10-25T01:00:00Z", channelId: 3021, channelName: "방송국", type: "QUEST", amount: 3000, message: "노래 한 곡", status: "PROCESSING", refundedAt: null, quest: { id: "q7", status: "IN_PROGRESS", endsAt: "2026-10-25T02:00:00Z", extendedMin: 0 }, game: null }]
              : [{ id: 88813, donatedAt: "2026-10-25T01:05:00Z", channelId: 3021, channelName: "방송국", type: "GACHA", amount: 1000, message: "", status: "COMPLETED", refundedAt: null, quest: null, game: { kind: "GACHA", status: "RESULT", result: "사인", blank: false } }],
          count: 1
        });
      throw new Error(`unexpected FLEXTV call ${p}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("퀘스트", () => {
  it("lets the supporter decide through FLEXTV, 성공 · 실패 only", async () => {
    const { decideMyQuest } = await import("@/services/donations/quests");
    expect(await decideMyQuest({ id: "q7", outcome: "FAILED" })).toEqual({ status: "OK", questStatus: "FAILED", refundedFn: 3000 });
    expect(await decideMyQuest({ id: "q7", outcome: "CANCELED" })).toEqual({ status: "INVALID" });
    expect(calls.filter((c) => c.path.endsWith("/decision")).map((c) => c.body)).toEqual([{ decision: "FAILED" }]);
  });

  it("lets the streamer cancel, and passes FLEXTV's refusal of a decision that is not theirs", async () => {
    const { decideReceivedQuest } = await import("./donationManagement");
    expect(await decideReceivedQuest({ id: "q7", outcome: "CANCELED" })).toMatchObject({ status: "OK", questStatus: "CANCELED" });
    expect(await decideReceivedQuest({ id: "q7", outcome: "SUCCESS" })).toEqual({ status: "FORBIDDEN" });
    member.creator = false;
    expect(await decideReceivedQuest({ id: "q7", outcome: "CANCELED" })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("fills the 리모컨's quest card with what the streamer may decide, and extends by request id", async () => {
    const { getQuestRemote, extendQuestTime } = await import("./questRemote");
    expect(await getQuestRemote()).toEqual({
      quests: [{ id: "q7", donor: "열혈시청자", donorId: "", title: "노래 한 곡", amount: 3000, createdAt: "2026-10-25T01:00:00Z", endsAt: "2026-10-25T02:00:00Z", extendedMin: 0, actions: ["CANCELED"] }],
      serverNow: "2026-10-25T01:20:00Z",
      allowExtension: true
    });
    expect(calls[0].query).toContain("status=IN_PROGRESS");
    expect(await extendQuestTime({ id: "q7", minutes: 10, requestId: "req-0000000000000001" })).toMatchObject({ status: "OK", minutes: 10 });
    expect(await extendQuestTime({ id: "q7", minutes: 90, requestId: "req-0000000000000002" })).toMatchObject({ status: "INVALID" });
    expect(calls.filter((c) => c.path.endsWith("/extension"))).toHaveLength(1);
  });

  it("lists the streamer's quests in 받은 후원", async () => {
    const { flextvReceivedQuests } = await import("./flextvBroadcastGames");
    expect(await flextvReceivedQuests({ status: "ALL", page: 1 })).toMatchObject({ total: 1, held: { amount: 3000, count: 1 }, items: [{ id: "q7", actions: ["CANCELED"] }] });
  });
});

describe("the 리모컨's 룰렛 · 뽑기", () => {
  it("sends each button as FLEXTV's action", async () => {
    const roulette = await import("./rouletteRemote");
    expect(await roulette.getRouletteRemote()).toMatchObject({ enabled: true, dailyLimit: 3 });
    expect(await roulette.startNextSpin()).toEqual({ status: "INVALID", message: "대기 중인 참여가 없어요." });
    expect(await roulette.setRoulettePaused({ paused: true })).toEqual({ status: "SAVED" });
    expect(await roulette.revealRouletteSpin({ spinId: "s1" })).toEqual({ status: "SAVED" });
    expect(await roulette.setRouletteSwitch({ key: "autoReveal", on: false })).toEqual({ status: "SAVED" });
    expect(await roulette.finishRouletteSpin({ spinId: "../x" })).toMatchObject({ status: "INVALID" });
    const gacha = await import("./gachaRemote");
    expect(await gacha.setGachaClaimed({ drawId: "d1", claimed: true })).toEqual({ status: "SAVED" });
    expect(calls.filter((c) => c.method === "POST").map((c) => c.body)).toEqual([
      { action: "START_NEXT" },
      { action: "PAUSE" },
      { action: "REVEAL", spinId: "s1" },
      { action: "SWITCH", key: "autoReveal", on: false },
      { action: "CLAIM", drawId: "d1" }
    ]);
  });
});

describe("OBS overlays", () => {
  it("draws FLEXTV's quests in the streamer's design, and serves neither unknown keys nor the alert overlay", async () => {
    const { getOverlayWidget } = await import("./widgetOverlay");
    const quest = await getOverlayWidget("quest", "overlay-key-00000000");
    expect(quest).toMatchObject({ widget: "quest", on: true, quests: [{ id: "q7", title: "노래 한 곡" }], theme: { theme: "BOLD", accent: "#FF3366" } });
    // The quest part of the design is read leniently: its look, the rest the defaults.
    expect(quest).toMatchObject({ settings: { style: "SIMPLE", maxCount: 1 } });
    expect(await getOverlayWidget("quest", "someone-elses-key-000")).toBe("FORBIDDEN");
    expect(await getOverlayWidget("goal", "overlay-key-00000000")).toBe("FORBIDDEN");
    const { getOverlayAlert } = await import("./alertRemote");
    expect(await getOverlayAlert("overlay-key-00000000")).toBe("FORBIDDEN");
  });

  it("gives the 리모컨 the streamer's key, and a new one on request", async () => {
    const { getFlextvRemote, reissueFlextvOverlayKey } = await import("./flextvRemote");
    expect(await getFlextvRemote()).toMatchObject({ overlayKey: "overlay-key-00000000", quest: { quests: [{ id: "q7" }] } });
    expect(await reissueFlextvOverlayKey()).toEqual({ status: "SAVED" });
    expect(calls.filter((c) => c.path === "/api/ssumnation/my/overlay-key").map((c) => c.method)).toEqual(["GET", "POST"]);
  });
});

describe("후원 내역", () => {
  it("fills the 퀘스트 and 게임 tabs from FLEXTV", async () => {
    const { getDonationHistory } = await import("@/services/wallet/walletHistory");
    const period = { preset: "month" as const, from: "2026-10-01", to: "2026-10-31" };
    const quests = (await getDonationHistory({ period, category: "quest" }))!;
    expect(quests.items[0]).toMatchObject({ id: "q7", creatorId: "3021", typeLabel: "퀘스트 후원", status: "PROCESSING", quest: { status: "IN_PROGRESS", canDecide: true } });
    const games = (await getDonationHistory({ period, category: "game" }))!;
    expect(games.items[0]).toMatchObject({ typeLabel: "뽑기 후원", gameResult: "뽑기 결과 · 사인 당첨", donatedAt: "2026-10-25 10:05:00" });
  });
});
