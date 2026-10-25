import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 6 (front first): 영상 후원 through FLEXTV's own send, and Ssumnation's types through the endpoints of
 * docs/development/flextv-ssumnation-api.md (FLEXTV_SSUMNATION_API on), against a stubbed FLEXTV API.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_WALLET: true, FLEXTV_DONATION: true, FLEXTV_SSUMNATION_API: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] }),
  getFlextvAccessToken: async () => "member-token"
}));

type Call = { path: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let balance: number;
let spends: { id: number; amount: number; targetId: string; targetnick: string; status: number; createdAt: string }[];
let wishPrice: number;
let video: Record<string, unknown> | null;
/** The Ssumnation endpoint: keeps one donation per key, as the contract requires. */
let ledger: Map<string, { body: Record<string, unknown>; answer: Record<string, unknown> }>;
let onOwnType: (body: Record<string, unknown>) => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const take = (body: Record<string, unknown>) => {
  balance -= Number(body.amount);
  const answer = { status: "COMPLETED", donationId: 900 + ledger.size, amount: body.amount, balance };
  ledger.set(String(body.idempotencyKey), { body, answer });
  return answer;
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvDonationKeys;
  delete g.__ssumnationFlextvDonationQueues;
  delete g.__ssumnationFlextvGames;
  calls = [];
  balance = 50_000;
  spends = [{ id: 100, amount: 300, targetId: "other", targetnick: "다른 방송", status: 9, createdAt: "2026-10-20T03:00:00Z" }];
  wishPrice = 30_000;
  video = { type: "youtube", enabled: true, maxLength: 60, minAmount: 100, unitAmount: 10 };
  ledger = new Map();
  onOwnType = (body) => {
    const seen = ledger.get(String(body.idempotencyKey));
    if (seen) return JSON.stringify(seen.body) === JSON.stringify(body) ? json(seen.answer) : json({ status: "CONFLICT" }, 409);
    return json(take(body));
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: u.pathname, method: init.method ?? "GET", body });
      switch (u.pathname) {
        case "/api/channels/3021/profile":
          return json({ id: 3021, name: "플렉스방송국", isInLive: true, owner: { id: 601900, loginId: "bj01", nickname: "방송인", PI: "Y" } });
        case "/api/channels/3021/gift-types":
          return json({ img: { host: [] }, txt: [] });
        case "/api/luv/effect-settings":
          return json(video ? [video] : []);
        case "/api/ssumnation/channels/3021/donation-settings":
          return json({
            mini: { enabled: true, minAmount: 100, maxAmount: 999, maxLength: 30, colors: [{ id: "pink", label: "핑크", hex: "#FF5CA8" }] },
            wishlist: [{ id: "w1", emoji: "🎧", name: "헤드셋", price: wishPrice, note: "", inStock: true }],
            game: { minAmount: 1000, maxTitle: 50 },
            drawing: { enabled: false },
            quest: { enabled: true, maxTimeSec: 1800, allowExtension: true },
            roulette: { enabled: true, minAmount: 500, dailyLimit: 0, items: [{ name: "노래", percent: 40 }, { name: "꽝", percent: 60 }] },
            gacha: []
          });
        case "/api/ssumnation/channels/3021/games":
          return json({ roulette: { waiting: 1, participantsToday: 3, usedToday: 1, mine: [{ id: "s1", no: "#RLT-00001", amount: 500, createdAt: "2026-10-25T01:00:00Z", status: "QUEUED", position: 1, result: "노래" }] }, gacha: { waiting: 0, usedToday: {}, mine: [] } });
        case "/api/luv/remain":
          return json({ amount: balance });
        case "/api/luv/sentluv-list":
          return json({ data: spends.slice(0, Number(u.searchParams.get("limit") ?? 5)), count: spends.length });
        case "/api/luv/send":
          balance -= Number(body.amount);
          spends.unshift({ id: spends[0].id + 1, amount: Number(body.amount), targetId: "bj01", targetnick: "방송인", status: 0, createdAt: new Date().toISOString() });
          return new Response("OK", { status: 200 });
        case "/api/ssumnation/donations":
          return onOwnType(body);
      }
      const lookup = /^\/api\/ssumnation\/donations\/([A-Za-z0-9-]+)$/.exec(u.pathname);
      if (lookup) {
        const seen = ledger.get(lookup[1]);
        return seen ? json(seen.answer) : json({ status: "NOT_FOUND" }, 404);
      }
      throw new Error(`unexpected FLEXTV call ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const key = (n = 1) => `key-${String(n).padStart(16, "0")}`;
const base = { creatorId: "3021", hideProfile: false, nicknameId: null, memberId: null };
const sent = (path: string) => calls.filter((c) => c.path === path && c.method === "POST");

describe("a FLEXTV channel's catalog", () => {
  it("offers 영상 and what the streamer turned on, priced as they set it", async () => {
    const { loadFlextvCatalog } = await import("./flextvDonate");
    const catalog = await loadFlextvCatalog("3021", "member-token");
    expect(catalog.types.map((t) => t.key)).toEqual(expect.arrayContaining(["TEXT", "MINI", "VIDEO", "WISHLIST", "ROULETTE", "QUEST"]));
    expect(catalog.types.map((t) => t.key)).not.toContain("GACHA");
    expect(catalog.types.map((t) => t.key)).not.toContain("DRAWING");
    expect(catalog.game).toEqual({ minAmount: 1000, maxText: 50, maxTimeSec: 1800 });
    expect(catalog.mediaPricing).toEqual({ VIDEO: { perSecond: 10, maxSec: 60 } });
    expect(catalog.minAmount).toMatchObject({ VIDEO: 100, MINI: 100 });
    expect(catalog.roulette).toMatchObject({ enabled: true, minAmount: 500 });

    video = { ...video, enabled: false };
    expect((await loadFlextvCatalog("3021", null)).types.map((t) => t.key)).not.toContain("VIDEO");
  });
});

describe("영상 후원", () => {
  const clip = { type: "VIDEO", videoUrl: "https://youtu.be/dQw4w9WgXcQ?t=3", startSec: 10, endSec: 40, termsAgreed: true };

  it("goes as FLEXTV's YouTube effect, the amount being the length × the streamer's price", async () => {
    const { requestDonation } = await import("./flextvDonate");
    expect(await requestDonation({ ...base, ...clip, amount: 300, idempotencyKey: key() })).toMatchObject({ status: "COMPLETED", fnAmount: 300 });
    const [send] = sent("/api/luv/send");
    expect(send.body).toEqual({
      channelId: 3021,
      amount: 300,
      count: 1,
      sendType: "youtube",
      effects: [{ type: "youtube", params: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", startSec: 10, endSec: 40 } }]
    });
  });

  it("refuses another price, a longer range, or a streamer who turned it off", async () => {
    const { requestDonation } = await import("./flextvDonate");
    expect(await requestDonation({ ...base, ...clip, amount: 1000, idempotencyKey: key(1) })).toMatchObject({ status: "INVALID" });
    expect(await requestDonation({ ...base, ...clip, endSec: 80, amount: 700, idempotencyKey: key(2) })).toMatchObject({ status: "INVALID" });
    video = null;
    expect(await requestDonation({ ...base, ...clip, amount: 300, idempotencyKey: key(3) })).toMatchObject({ status: "INVALID" });
    expect(sent("/api/luv/send")).toHaveLength(0);
  });
});

describe("Ssumnation's own types", () => {
  it("sends 미니 · 위시리스트 · 룰렛 by the key, without the voice choice", async () => {
    const { requestDonation } = await import("./flextvDonate");
    expect(await requestDonation({ ...base, type: "MINI", amount: 500, text: "안녕", colorId: "pink", idempotencyKey: key(1) })).toEqual({ status: "COMPLETED", donationId: "flextv-900", fnAmount: 500, balance: 49_500 });
    expect(await requestDonation({ ...base, type: "WISHLIST", itemId: "w1", message: "응원해요", voiceId: null, expectedAmount: 30_000, idempotencyKey: key(2) })).toMatchObject({ status: "COMPLETED", fnAmount: 30_000 });
    expect(await requestDonation({ ...base, type: "ROULETTE", amount: 500, idempotencyKey: key(3) })).toMatchObject({ status: "COMPLETED" });
    expect(sent("/api/ssumnation/donations").map((c) => c.body)).toEqual([
      { idempotencyKey: key(1), channelId: 3021, type: "MINI", amount: 500, message: "", details: { text: "안녕", colorId: "pink" } },
      { idempotencyKey: key(2), channelId: 3021, type: "WISHLIST", amount: 30_000, message: "응원해요", details: { itemId: "w1" } },
      { idempotencyKey: key(3), channelId: 3021, type: "ROULETTE", amount: 500, message: "", details: {} }
    ]);
    expect(sent("/api/luv/send")).toHaveLength(0);
  });

  it("sends a 퀘스트 as its 성공 보상, within the streamer's time limit", async () => {
    const { requestDonation } = await import("./flextvDonate");
    const quest = { ...base, type: "QUEST", title: "노래 한 곡", successReward: 3000, timeLimitSec: 600, creatorDecides: true, termsAgreed: true };
    expect(await requestDonation({ ...quest, idempotencyKey: key(1) })).toMatchObject({ status: "COMPLETED", fnAmount: 3000 });
    expect(sent("/api/ssumnation/donations")[0].body).toEqual({
      idempotencyKey: key(1),
      channelId: 3021,
      type: "QUEST",
      amount: 3000,
      message: "",
      details: { title: "노래 한 곡", timeLimitSec: 600, creatorDecides: true }
    });
    // Longer than the streamer allows (30 minutes), or under the shared minimum.
    expect(await requestDonation({ ...quest, timeLimitSec: 3600, idempotencyKey: key(2) })).toMatchObject({ status: "INVALID" });
    expect(await requestDonation({ ...quest, successReward: 500, idempotencyKey: key(3) })).toMatchObject({ status: "INVALID" });
    expect(sent("/api/ssumnation/donations")).toHaveLength(1);
  });

  it("checks the streamer's settings and prices first", async () => {
    const { requestDonation } = await import("./flextvDonate");
    expect(await requestDonation({ ...base, type: "MINI", amount: 1000, text: "안녕", colorId: "pink", idempotencyKey: key(1) })).toMatchObject({ status: "INVALID" });
    expect(await requestDonation({ ...base, type: "ROULETTE", amount: 100, idempotencyKey: key(2) })).toMatchObject({ status: "INVALID" });
    wishPrice = 35_000;
    expect(await requestDonation({ ...base, type: "WISHLIST", itemId: "w1", message: "", voiceId: null, expectedAmount: 30_000, idempotencyKey: key(3) })).toEqual({ status: "PRICE_CHANGED", amount: 35_000 });
    expect(await requestDonation({ ...base, type: "GACHA", gachaId: "g1", termsAgreed: true, expectedAmount: 3000, idempotencyKey: key(4) })).toMatchObject({ status: "INVALID" });
    expect(sent("/api/ssumnation/donations")).toHaveLength(0);
  });

  it("asks FLEXTV again by the key when its answer was lost, and sends again only if FLEXTV never got it", async () => {
    const { requestDonation } = await import("./flextvDonate");
    const mini = { ...base, type: "MINI", amount: 500, text: "안녕", colorId: "pink" };
    // Taken, but the answer is lost.
    onOwnType = (body) => {
      take(body);
      return new Response("InternalError", { status: 500 });
    };
    expect(await requestDonation({ ...mini, idempotencyKey: key(1) })).toMatchObject({ status: "COMPLETED", fnAmount: 500 });
    expect(sent("/api/ssumnation/donations")).toHaveLength(1);

    // Never reached FLEXTV: the lookup says so, and the same key goes again.
    let first = true;
    onOwnType = (body) => {
      if (first) {
        first = false;
        return new Response("Bad Gateway", { status: 502 });
      }
      return json(take(body));
    };
    expect(await requestDonation({ ...mini, idempotencyKey: key(2) })).toMatchObject({ status: "COMPLETED" });
    expect(sent("/api/ssumnation/donations").map((c) => c.body!.idempotencyKey)).toEqual([key(1), key(2), key(2)]);
    expect(ledger.size).toBe(2);
  });

  it("keeps a donation FLEXTV is still working on IN_PROGRESS, and the same key settles it", async () => {
    const { requestDonation } = await import("./flextvDonate");
    const roulette = { ...base, type: "ROULETTE", amount: 500, idempotencyKey: key(1) };
    onOwnType = () => json({ status: "PROCESSING" }, 202);
    expect(await requestDonation(roulette)).toEqual({ status: "IN_PROGRESS" });
    // FLEXTV finished it meanwhile.
    ledger.set(key(1), { body: {}, answer: { status: "COMPLETED", donationId: 950, amount: 500, balance: 49_500 } });
    expect(await requestDonation(roulette)).toEqual({ status: "COMPLETED", donationId: "flextv-950", fnAmount: 500, balance: 49_500 });
    expect(await requestDonation({ ...roulette, amount: 600 })).toEqual({ status: "CONFLICT" });
  });

  it("passes FLEXTV's refusals on in its words", async () => {
    onOwnType = () => json({ status: "LIMIT_REACHED", message: "오늘 참여할 수 있는 횟수를 다 썼어요." }, 400);
    const { requestDonation } = await import("./flextvDonate");
    expect(await requestDonation({ ...base, type: "ROULETTE", amount: 500, idempotencyKey: key() })).toEqual({ status: "INVALID", message: "오늘 참여할 수 있는 횟수를 다 썼어요." });
  });

  it("fills the room's 룰렛 panel from FLEXTV, without results not yet revealed", async () => {
    const { getRoomRoulette } = await import("./roulette");
    expect(await getRoomRoulette("3021")).toEqual({ waiting: 1, participantsToday: 3, usedToday: 1, mine: [{ id: "s1", no: "#RLT-00001", amount: 500, createdAt: "2026-10-25T01:00:00Z", status: "QUEUED", position: 1, result: null }] });
  });
});
