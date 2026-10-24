import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 후원 to a FLEXTV channel (services/donations/flextvDonate.ts through `requestDonation`), against a stubbed FLEXTV API:
 * what FLEXTV is sent, its refusals, and one debit per confirmed donation even when FLEXTV's answer is lost.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_WALLET: true, FLEXTV_DONATION: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] }),
  getFlextvAccessToken: async () => "member-token"
}));

type Call = { path: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let balance: number;
let spends: { id: number; amount: number; targetId: string; targetnick: string; status: number; createdAt: string }[];
let ownerPI: string | null;
let live: boolean;
/** What FLEXTV does with a send: debit and answer, debit and fail, or refuse. */
let onSend: (body: Record<string, unknown>) => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const debit = (body: Record<string, unknown>) => {
  balance -= Number(body.amount);
  spends.unshift({ id: (spends[0]?.id ?? 100) + 1, amount: Number(body.amount), targetId: "bj01", targetnick: "방송인", status: 0, createdAt: new Date().toISOString() });
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  calls = [];
  balance = 5000;
  spends = [{ id: 100, amount: 300, targetId: "other", targetnick: "다른 방송", status: 9, createdAt: "2026-10-20T03:00:00Z" }];
  ownerPI = "Y";
  live = true;
  onSend = (body) => {
    debit(body);
    return new Response("OK", { status: 200 });
  };
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvDonationKeys;
  delete g.__ssumnationFlextvDonationQueues;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: u.pathname, method: init.method ?? "GET", body });
      switch (u.pathname) {
        case "/api/channels/3021/profile":
          return json({ id: 3021, name: "플렉스방송국", isInLive: live, owner: { id: 601900, loginId: "bj01", nickname: "방송인", PI: ownerPI } });
        case "/api/channels/9999/profile":
          return new Response("INVALID_CHANNEL_ID", { status: 400 });
        case "/api/channels/3021/gift-types":
          return json({ img: { host: [{ code: "sig-1000", name: "하트 뿅", amount: 1000, imgUrl: "https://static.flextv.test/s.png" }] }, txt: [] });
        case "/api/channels/3021/active-stream":
          return live ? json({ id: 77, title: "저녁 방송" }) : new Response(null, { status: 204 });
        case "/api/channels/3021/stream/message":
          return json({ ok: true });
        case "/api/luv/remain":
          return json({ amount: balance });
        case "/api/luv/sentluv-list":
          return json({ data: spends.slice(0, Number(u.searchParams.get("limit") ?? 5)), count: spends.length });
        case "/api/luv/send":
          return onSend(body);
      }
      throw new Error(`unexpected FLEXTV call ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const load = () => import("./donate");
const key = () => crypto.randomUUID();
const text = (over: Record<string, unknown> = {}) => ({ type: "TEXT", amount: 1000, message: "응원해요!", voiceId: null, creatorId: "3021", hideProfile: false, idempotencyKey: key(), ...over });
const sends = () => calls.filter((c) => c.path === "/api/luv/send");

describe("FLEXTV 채널 후원 카탈로그", () => {
  it("offers 일반 후원 and the channel's signatures only, with FLEXTV's minimum", async () => {
    const { flextvCatalog } = await import("./flextvDonate");
    const catalog = flextvCatalog([{ code: "sig-1000", name: "하트 뿅", amount: 1000, imageUrl: "https://static.flextv.test/s.png" }]);
    expect(catalog.types.map((t) => [t.key, t.available])).toEqual([
      ["TEXT", true],
      ["SIGNATURE", true]
    ]);
    expect(catalog.minAmount.TEXT).toBe(1);
    expect(catalog.voices).toEqual([]);
    expect(catalog.signatures).toEqual([{ id: "sig-1000", name: "하트 뿅", price: 1000, imageUrl: "https://static.flextv.test/s.png", favorite: false, rank: 1 }]);
    expect(flextvCatalog([]).types.map((t) => t.key)).toEqual(["TEXT"]);
  });
});

describe("FLEXTV 채널 후원", () => {
  it("sends FLEXTV's donation with the message as TTS, shows it in chat, and answers with FLEXTV's record and balance", async () => {
    const { requestDonation } = await load();
    expect(await requestDonation(text())).toEqual({ status: "COMPLETED", donationId: "flextv-101", fnAmount: 1000, balance: 4000 });
    expect(sends()[0].body).toEqual({ channelId: 3021, amount: 1000, count: 1, sendType: "default", effect: { type: "tts", params: { actorId: "", message: "응원해요!" } } });
    expect(calls.find((c) => c.path === "/api/channels/3021/stream/message")?.body).toEqual({ streamId: 77, source: "web", message: "응원해요!", messageType: 0 });
  });

  it("sends a signature by FLEXTV's code at its current amount, and refuses a changed one before sending", async () => {
    const { requestDonation } = await load();
    expect(await requestDonation({ type: "SIGNATURE", signatureId: "sig-1000", message: "", expectedAmount: 1000, creatorId: "3021", hideProfile: false, idempotencyKey: key() })).toMatchObject({
      status: "COMPLETED",
      fnAmount: 1000
    });
    expect(sends()[0].body).toEqual({ channelId: 3021, amount: 1000, count: 1, sendType: "default", code: "sig-1000" });
    expect(await requestDonation({ type: "SIGNATURE", signatureId: "sig-1000", message: "", expectedAmount: 500, creatorId: "3021", hideProfile: false, idempotencyKey: key() })).toEqual({
      status: "PRICE_CHANGED",
      amount: 1000
    });
    expect(sends()).toHaveLength(1);
  });

  it("checks before sending: the balance, the channel, a recipient who cannot receive, what FLEXTV has no place for", async () => {
    const { requestDonation } = await load();
    expect(await requestDonation(text({ amount: 6000 }))).toEqual({ status: "INSUFFICIENT_FN", balance: 5000, required: 6000 });
    expect(await requestDonation(text({ creatorId: "9999" }))).toEqual({ status: "NOT_FOUND" });
    expect(await requestDonation(text({ hideProfile: true }))).toEqual({ status: "INVALID", message: "FLEXTV 채널에는 익명으로 후원할 수 없어요." });
    expect(await requestDonation(text({ message: "가".repeat(101) }))).toMatchObject({ status: "INVALID" });
    expect(await requestDonation({ ...text(), type: "ROULETTE" })).toMatchObject({ status: "INVALID" });
    ownerPI = null;
    expect(await requestDonation(text())).toEqual({ status: "INVALID", message: "이 크리에이터는 아직 후원을 받을 수 없어요." });
    expect(sends()).toHaveLength(0);
  });

  it("passes FLEXTV's refusals on in Ssumnation's words", async () => {
    onSend = () => json({ message: "본인인증 해주세요" }, 400);
    const { requestDonation } = await load();
    expect(await requestDonation(text())).toEqual({ status: "INVALID", message: "후원하려면 본인인증이 필요해요. FLEXTV에서 본인인증을 진행해 주세요." });
    onSend = () => json({ message: "차단된 계정입니다" }, 400);
    expect(await requestDonation(text())).toEqual({ status: "INVALID", message: "이 채널에서 후원이 제한된 계정이에요." });
    expect(balance).toBe(5000);
  });

  it("sends once per key: a retry gets the first answer, another request with the key is refused", async () => {
    const { requestDonation } = await load();
    const first = text();
    const [a, b] = await Promise.all([requestDonation(first), requestDonation(first)]);
    expect(a).toEqual(b);
    expect(sends()).toHaveLength(1);
    expect(await requestDonation({ ...first, amount: 2000 })).toEqual({ status: "CONFLICT" });
  });

  it("sends one donation at a time per member", async () => {
    let inFlight = 0;
    let most = 0;
    onSend = (body) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      debit(body);
      inFlight -= 1;
      return new Response("OK", { status: 200 });
    };
    const { requestDonation } = await load();
    const results = await Promise.all([requestDonation(text({ amount: 1000 })), requestDonation(text({ amount: 2000 }))]);
    expect(results.map((r) => r.status)).toEqual(["COMPLETED", "COMPLETED"]);
    expect(most).toBe(1);
    expect(balance).toBe(2000);
  });
});

describe("FLEXTV 후원 · 결과를 모를 때", () => {
  it("is completed when FLEXTV debited but then failed (its record has the donation)", async () => {
    onSend = (body) => {
      debit(body);
      return new Response("InternalError", { status: 500 });
    };
    const { requestDonation } = await load();
    expect(await requestDonation(text())).toEqual({ status: "COMPLETED", donationId: "flextv-101", fnAmount: 1000, balance: 4000 });
  });

  it("stays unknown while FLEXTV may still be on it, and is not sent once that window passed — never sent twice", async () => {
    onSend = () => new Response("InternalError", { status: 500 });
    const { requestDonation } = await load();
    const { SETTLE_WINDOW_MS } = await import("./flextvDonate");
    const request = text();
    expect(await requestDonation(request)).toEqual({ status: "IN_PROGRESS" });
    // The same key asks FLEXTV's record again instead of sending again.
    expect(await requestDonation(request)).toEqual({ status: "IN_PROGRESS" });
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + SETTLE_WINDOW_MS + 1);
    expect(await requestDonation(request)).toEqual({ status: "INVALID", message: "후원을 보내지 못했어요. 잠시 후 다시 시도해 주세요." });
    expect(sends()).toHaveLength(1);
    expect(balance).toBe(5000);
  });

  it("learns a late debit on the retry", async () => {
    let held: Record<string, unknown> | null = null;
    onSend = (body) => {
      held = body;
      return new Response("InternalError", { status: 500 });
    };
    const { requestDonation } = await load();
    const request = text();
    expect(await requestDonation(request)).toEqual({ status: "IN_PROGRESS" });
    debit(held!); // FLEXTV finished after all
    expect(await requestDonation(request)).toEqual({ status: "COMPLETED", donationId: "flextv-101", fnAmount: 1000, balance: 4000 });
    expect(sends()).toHaveLength(1);
  });
});
