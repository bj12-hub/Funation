import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 미니후원 overlay (2026-10-08, `/overlay/widget/mini/[key]`): the latest mini donations at or above 최소 표시 금액,
 * newest first, in the widget's 오버레이 테마; other donation types stay off it.
 */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  const widgets = await import("./widgetSettings");
  const overlay = await import("./widgetOverlay");
  const store = await import("./widgetStore");
  const core = await import("./widgetOverlayCore");
  const { mockCreator } = await import("./mockCreatorStore");
  // The room creators are c1…; the studio channel (the only one with overlays) stands in for one, as in donate.test.
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 50_000;
  return { requestDonation, ...widgets, ...overlay, ...store, ...core, key: mockCreator.integrationKey };
}

const mini = (n: number, amount: number, text: string) => ({ creatorId: "studio", hideProfile: false, type: "MINI", amount, text, colorId: "pink", idempotencyKey: key(n) });

async function miniOverlay(m: Awaited<ReturnType<typeof load>>) {
  const read = await m.getOverlayWidget("mini", m.key);
  if (read === "FORBIDDEN" || read.widget !== "mini") throw new Error("mini overlay");
  return read;
}

describe("미니후원 오버레이", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  it("shows mini donations newest first, leaves other types out and needs the integration key", async () => {
    const m = await load();
    expect(await m.requestDonation(mini(1, 100, "첫 미니"))).toMatchObject({ status: "COMPLETED" });
    expect(await m.requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount: 1_000, message: "일반 후원", voiceId: null, idempotencyKey: key(2) })).toMatchObject({ status: "COMPLETED" });
    expect(await m.requestDonation(mini(3, 500, "두 번째 미니"))).toMatchObject({ status: "COMPLETED" });

    const read = await miniOverlay(m);
    expect(read.lines.map((l) => [l.text, l.amount])).toEqual([
      ["두 번째 미니", "500 FN"],
      ["첫 미니", "100 FN"]
    ]);
    expect(await m.getOverlayWidget("mini", "wrong-key")).toBe("FORBIDDEN");
    expect((await m.getWidgetDetail("MINI"))!.overlayPath).toBe(`/overlay/widget/mini/${m.key}`);
  });

  it("hides mini donations under 최소 표시 금액 and keeps only the latest few", async () => {
    const m = await load();
    for (let i = 1; i <= m.MINI_LINES + 2; i++) await m.requestDonation(mini(i, 100 * i, `미니 ${i}`));
    let read = await miniOverlay(m);
    expect(read.lines).toHaveLength(m.MINI_LINES);
    expect(read.lines[0].text).toBe(`미니 ${m.MINI_LINES + 2}`);

    expect(await m.saveWidgetSettings("MINI", { ...m.readWidget("MINI"), minAmount: 600 })).toEqual({ status: "SAVED" });
    read = await miniOverlay(m);
    // 100 … 700 FN sent; only 600 and 700 reach 최소 표시 금액 600.
    expect(read.lines.map((l) => l.text)).toEqual(["미니 7", "미니 6"]);
  });

  it("starts on the theme card, sends its own theme, and reads older settings as 전체 테마 without a card", async () => {
    const m = await load();
    expect(DEFAULT_WIDGET_SETTINGS.MINI).toMatchObject({ theme: "INHERIT", card: true });
    expect(await m.saveWidgetSettings("MINI", { ...DEFAULT_WIDGET_SETTINGS.MINI, theme: "GLASS" })).toEqual({ status: "SAVED" });
    expect((await miniOverlay(m)).theme.theme).toBe("GLASS");

    // Saved before the 미니후원 overlay (no theme · card): 전체 테마 따르기, text only.
    const legacy: Record<string, unknown> = structuredClone(DEFAULT_WIDGET_SETTINGS.MINI);
    delete legacy.theme;
    delete legacy.card;
    (m.widgetStore as Record<string, unknown>).MINI = structuredClone(legacy);
    expect(m.readWidget("MINI")).toMatchObject({ theme: "INHERIT", card: false });
    expect(await m.saveWidgetSettings("MINI", legacy)).toEqual({ status: "SAVED" });
    expect(m.readWidget("MINI")).toMatchObject({ theme: "INHERIT", card: false });
  });
});
