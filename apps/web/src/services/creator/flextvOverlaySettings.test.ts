import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINI_PALETTE } from "./donationTypeSettings";

/** Phase 8: the 위젯 page's theme and looks kept by FLEXTV (§10), against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_SSUMNATION_API: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

let stored: Record<string, unknown> | null;
let puts: Record<string, unknown>[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const types = {
  mini: { enabled: true, minAmount: 100, maxAmount: 999, colors: MINI_PALETTE.map((c) => ({ id: c.id })) },
  wishlist: [],
  game: { minAmount: 1000 },
  drawing: { enabled: false },
  quest: { enabled: true, maxTimeSec: 600, allowExtension: true },
  roulette: { enabled: true, minAmount: 1000, dailyLimit: 0, items: [{ name: "꽝", percent: 50 }, { name: "노래", percent: 50 }] },
  gacha: [{ id: "g-1", enabled: true, name: "행운 뽑기", price: 2000, mode: "PROBABILITY", limit: null, prizes: [{ name: "사인", blank: false, percent: 100, left: null }] }]
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  member.creator = true;
  stored = null;
  puts = [];
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvOverlayDesigns;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const p = new URL(url).pathname;
      if (p === "/api/ssumnation/my/overlay-design" && init.method === "PUT") {
        const body = JSON.parse(String(init.body));
        puts.push(body.design);
        stored = body.design;
        return json({ status: "SAVED" });
      }
      if (p === "/api/ssumnation/my/overlay-design") return stored ? json({ status: "OK", design: stored }) : json({ status: "NOT_FOUND" }, 404);
      if (p === "/api/ssumnation/my/donation-settings") return json({ status: "OK", ...types });
      if (p === "/api/ssumnation/my/overlay-key") return json({ key: "overlay-key-00000000" });
      if (p === "/api/ssumnation/overlay/overlay-key-00000000/design") return json({ design: stored });
      if (p.startsWith("/api/ssumnation/overlay/")) return json({ status: "NOT_FOUND" }, 404);
      throw new Error(`unexpected FLEXTV call ${init.method ?? "GET"} ${p}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("오버레이 테마", () => {
  it("starts from the default and saves the streamer's", async () => {
    const { getOverlayAppearance, saveOverlayAppearance } = await import("./overlayTheme");
    expect(await getOverlayAppearance()).toEqual({ theme: "PILL", accent: null });
    expect(await saveOverlayAppearance({ theme: "NEON", accent: null })).toMatchObject({ status: "INVALID" });
    expect(puts).toHaveLength(0);
    expect(await saveOverlayAppearance({ theme: "BOLD", accent: "#ff3366" })).toEqual({ status: "SAVED" });
    expect(puts[0]).toMatchObject({ version: 1, appearance: { theme: "BOLD", accent: "#FF3366" } });
    expect(await getOverlayAppearance()).toEqual({ theme: "BOLD", accent: "#FF3366" });
    member.creator = false;
    expect(await saveOverlayAppearance({ theme: "PILL", accent: null })).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("a widget's popup", () => {
  it("shows the look with 후원 종류 설정's 뽑기, and FLEXTV's overlay address", async () => {
    const { getWidgetDetail } = await import("./widgetSettings");
    const detail = (await getWidgetDetail("GACHA"))!;
    expect(detail.overlayPath).toBe("/overlay/widget/gacha/overlay-key-00000000");
    expect(detail.live).toMatchObject({ designOnly: true, gachaBoardUrl: "/overlay/widget/gacha-board/overlay-key-00000000" });
    expect(detail.settings).toMatchObject({ gachas: [{ id: "g-1", name: "행운 뽑기", price: 2000 }] });
    // Widgets FLEXTV runs no overlay for are not there.
    expect(await getWidgetDetail("GOAL")).toBeNull();
  });

  it("saves only the look, keeping the other parts of the document", async () => {
    const { getWidgetDetail, saveWidgetSettings } = await import("./widgetSettings");
    const { saveOverlayAppearance } = await import("./overlayTheme");
    await saveOverlayAppearance({ theme: "GLASS", accent: null });
    const detail = (await getWidgetDetail("GACHA"))!;
    const draft = detail.settings as { gachas: { id: string; style: string; pointColor: string }[] };
    const changed = { ...draft, gachas: draft.gachas.map((g) => ({ ...g, style: "BOX", pointColor: "#00AA00", price: 1 })) };
    expect(await saveWidgetSettings("GACHA", changed)).toEqual({ status: "SAVED" });
    expect(stored).toMatchObject({ appearance: { theme: "GLASS" }, gacha: { looks: { "g-1": { style: "BOX", pointColor: "#00AA00" } } } });
    expect(JSON.stringify(stored)).not.toContain("price");
    expect(await saveWidgetSettings("GOAL", {})).toMatchObject({ status: "INVALID" });
  });

  it("draws the overlay with the saved look", async () => {
    const { saveWidgetSettings, getWidgetDetail } = await import("./widgetSettings");
    const mini = (await getWidgetDetail("MINI"))!;
    await saveWidgetSettings("MINI", { ...mini.settings, minAmount: 300, style: "BUBBLE" });
    const { overlayDesign } = await import("./flextvOverlaySettings");
    expect((await overlayDesign("overlay-key-00000000"))?.mini).toMatchObject({ minAmount: 300, style: "BUBBLE" });
    expect(await overlayDesign("someone-elses-key-000")).toBeUndefined();
  });
});
