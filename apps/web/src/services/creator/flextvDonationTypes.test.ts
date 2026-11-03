import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TYPE_SETTINGS, parseTypeSettings, type DonationTypeSettings } from "./donationTypeSettings";

/** 후원 종류 설정 with FLEXTV (phase 6): the form's rules, and the save through the contract's §5, against a stub. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
const flags = { api: true };
vi.mock("@/lib/flextv/mode", () => ({
  FLEXTV_BACKEND: true,
  FLEXTV_AUTH: true,
  FLEXTV_STUDIO: true,
  get FLEXTV_SSUMNATION_API() {
    return flags.api;
  },
  FLEXTV_WEB_URL: "https://www.flextv.test"
}));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

const settings = (over: Partial<DonationTypeSettings> = {}): DonationTypeSettings => ({
  mini: { enabled: true, minAmount: 100, maxAmount: 999, colorIds: ["white", "pink"] },
  wishlist: [{ id: "w1", emoji: "🎧", name: "헤드셋", price: 30_000, note: "", inStock: true }],
  game: { minAmount: 1000 },
  drawing: { enabled: false },
  quest: { enabled: true, maxTimeSec: 1800, allowExtension: true },
  roulette: { enabled: true, minAmount: 500, dailyLimit: 3, items: [{ name: "노래", percent: 40 }, { name: "꽝", percent: 60 }] },
  gacha: [{ id: null, enabled: true, name: "행운 뽑기", price: 1000, mode: "PROBABILITY", limit: 2, prizes: [{ name: "꽝", blank: true, percent: 50, left: null }, { name: "사인", blank: false, percent: 50, left: null }] }],
  ...over
});

describe("the form's rules", () => {
  it("keeps 미니 under 1,000 FN, with a color", () => {
    expect(parseTypeSettings(settings())).toEqual(settings());
    expect(parseTypeSettings(settings({ mini: { enabled: true, minAmount: 100, maxAmount: 1000, colorIds: ["pink"] } }))).toMatchObject({ invalid: expect.stringContaining("999") });
    expect(parseTypeSettings(settings({ mini: { enabled: true, minAmount: 500, maxAmount: 100, colorIds: ["pink"] } }))).toMatchObject({ invalid: expect.any(String) });
    expect(parseTypeSettings(settings({ mini: { enabled: true, minAmount: 100, maxAmount: 999, colorIds: ["neon"] } }))).toMatchObject({ invalid: expect.stringContaining("색") });
    // Off, it may keep no color.
    expect(parseTypeSettings(settings({ mini: { enabled: false, minAmount: 100, maxAmount: 999, colorIds: [] } }))).not.toHaveProperty("invalid");
  });

  it("needs a wheel of 100% only while 룰렛 is on, and checks every 뽑기", () => {
    const uneven = { enabled: true, minAmount: 500, dailyLimit: 0, items: [{ name: "노래", percent: 40 }, { name: "꽝", percent: 40 }] };
    expect(parseTypeSettings(settings({ roulette: uneven }))).toMatchObject({ invalid: expect.stringContaining("100%") });
    expect(parseTypeSettings(settings({ roulette: { ...uneven, enabled: false } }))).not.toHaveProperty("invalid");
    expect(parseTypeSettings(settings({ roulette: { ...uneven, items: [{ name: "하나뿐", percent: 100 }] } }))).toMatchObject({ invalid: expect.stringContaining("2") });
    expect(parseTypeSettings(settings({ roulette: { ...uneven, items: [{ name: "열세 글자가 넘는 긴 항목", percent: 50 }, { name: "꽝", percent: 50 }] } }))).toMatchObject({ invalid: expect.any(String) });

    const g = settings().gacha[0];
    expect(parseTypeSettings(settings({ gacha: [{ ...g, prizes: [{ ...g.prizes[0], percent: 30 }, g.prizes[1]] }] }))).toMatchObject({ invalid: expect.stringContaining("100%") });
    expect(parseTypeSettings(settings({ gacha: [{ ...g, mode: "STOCK", prizes: [{ name: "사인", blank: false, percent: null, left: 5 }] }] }))).not.toHaveProperty("invalid");
    expect(parseTypeSettings(settings({ gacha: [{ ...g, prizes: [] }] }))).toMatchObject({ invalid: expect.stringContaining("상품") });
  });

  it("keeps the 퀘스트 time limit in whole minutes, 1 ~ 60", () => {
    expect(parseTypeSettings(settings({ quest: { enabled: true, maxTimeSec: 3_660, allowExtension: false } }))).toMatchObject({ invalid: expect.stringContaining("60분") });
    expect(parseTypeSettings(settings({ quest: { enabled: true, maxTimeSec: 90, allowExtension: false } }))).toMatchObject({ invalid: expect.any(String) });
    expect(parseTypeSettings(settings({ game: { minAmount: 0 } }))).toMatchObject({ invalid: expect.stringContaining("퀘스트") });
  });

  it("refuses a wishlist item without a name or a price", () => {
    expect(parseTypeSettings(settings({ wishlist: [{ id: null, emoji: "🎁", name: " ", price: 1000, note: "", inStock: true }] }))).toMatchObject({ invalid: expect.stringContaining("위시리스트") });
    expect(parseTypeSettings(settings({ wishlist: [{ id: null, emoji: "🎁", name: "마이크", price: 0, note: "", inStock: true }] }))).toMatchObject({ invalid: expect.any(String) });
  });
});

type Call = { path: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let stored: Record<string, unknown> | null;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  flags.api = true;
  member.creator = true;
  calls = [];
  stored = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: u.pathname, method: init.method ?? "GET", body });
      if (u.pathname !== "/api/ssumnation/my/donation-settings") throw new Error(`unexpected FLEXTV call ${u.pathname}`);
      if (init.method === "PUT") {
        if ((body.roulette as { minAmount: number }).minAmount < 100) return json({ status: "INVALID", message: "룰렛 참여 금액은 100렉스 이상이에요." }, 400);
        stored = { ...body, gacha: (body.gacha as Record<string, unknown>[]).map((g, i) => ({ ...g, id: g.id ?? `g${i + 1}` })) };
        return json({ status: "SAVED", settings: stored });
      }
      return stored ? json(stored) : json({ status: "NOT_FOUND" }, 404);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("saving through FLEXTV", () => {
  it("starts from everything off, saves FLEXTV's shape and shows back what FLEXTV kept", async () => {
    const { getDonationTypeSettings, saveDonationTypeSettings } = await import("./flextvDonationTypes");
    expect(await getDonationTypeSettings()).toEqual(DEFAULT_TYPE_SETTINGS);

    const saved = await saveDonationTypeSettings(settings());
    expect(saved).toMatchObject({ status: "SAVED", settings: { gacha: [{ id: "g1", name: "행운 뽑기" }] } });
    const [put] = calls.filter((c) => c.method === "PUT");
    expect(put.body).toMatchObject({
      mini: { enabled: true, minAmount: 100, maxAmount: 999, maxLength: 30, colors: [{ id: "white", label: "흰색", hex: "#ffffff" }, { id: "pink", label: "분홍", hex: "#ec4899" }] },
      game: { minAmount: 1000, maxTitle: 50 },
      drawing: { enabled: false },
      quest: { enabled: true, maxTimeSec: 1800, allowExtension: true },
      roulette: { enabled: true, minAmount: 500, dailyLimit: 3 }
    });
    expect(await getDonationTypeSettings()).toMatchObject({ mini: { colorIds: ["white", "pink"] }, roulette: { dailyLimit: 3 } });
  });

  it("checks before FLEXTV, and passes FLEXTV's refusal on", async () => {
    const { saveDonationTypeSettings } = await import("./flextvDonationTypes");
    expect(await saveDonationTypeSettings(settings({ mini: { enabled: true, minAmount: 100, maxAmount: 5000, colorIds: ["pink"] } }))).toMatchObject({ status: "INVALID" });
    expect(calls).toHaveLength(0);
    expect(await saveDonationTypeSettings(settings({ roulette: { ...settings().roulette, minAmount: 50 } }))).toEqual({ status: "INVALID", message: "룰렛 참여 금액은 100렉스 이상이에요." });
  });

  it("is the streamer's, and only with FLEXTV's Ssumnation endpoints", async () => {
    member.creator = false;
    const { getDonationTypeSettings, saveDonationTypeSettings } = await import("./flextvDonationTypes");
    expect(await getDonationTypeSettings()).toBeNull();
    expect(await saveDonationTypeSettings(settings())).toEqual({ status: "UNAUTHORIZED" });
    member.creator = true;
    flags.api = false;
    expect(await getDonationTypeSettings()).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
