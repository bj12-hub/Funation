import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 이모지 리액션 · 레이어 효과: creator triggers, resolved per alert on the server. */
async function load() {
  const fx = await import("./effects");
  const remote = await import("./alertRemote");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...fx, ...remote, overlayKey: mockCreator.integrationKey };
}

const settings = {
  emoji: { enabled: true, minFn: 5_000, emojis: ["🔥", "🎉"], count: 12 },
  layer: {
    enabled: true,
    tiers: [
      { minFn: 100_000, effect: "FIREWORKS" },
      { minFn: 10_000, effect: "HEARTS" }
    ]
  }
};

describe("effects", () => {
  beforeEach(() => resetMockStores());

  it("plays nothing by default and resolves the saved triggers for the alert on screen", async () => {
    const m = await load();
    await m.sendTestAlert({ requestId: key(1), amount: 50_000, donor: "A" });
    expect(await m.getOverlayEffects(m.overlayKey)).toMatchObject({ emoji: null, layer: null });

    expect(await m.saveEffectSettings(settings)).toEqual({ status: "SAVED" });
    expect((await m.getEffectSettings())!.layer.tiers.map((t) => t.minFn)).toEqual([10_000, 100_000]);
    const fx = await m.getOverlayEffects(m.overlayKey);
    expect(fx).toMatchObject({ emoji: { emojis: ["🔥", "🎉"], count: 12 }, layer: "HEARTS" });
    if (fx === "FORBIDDEN") throw new Error("forbidden");
    expect(fx.alertId).not.toBeNull();

    await m.skipCurrentAlert({ alertId: (await m.getRemoteView())!.showing!.id });
    await m.sendTestAlert({ requestId: key(2), amount: 3_000, donor: "B" });
    expect(await m.getOverlayEffects(m.overlayKey)).toMatchObject({ emoji: null, layer: null });
    await m.skipCurrentAlert({ alertId: (await m.getRemoteView())!.showing!.id });
    await m.sendTestAlert({ requestId: key(3), amount: 200_000, donor: "C" });
    expect(await m.getOverlayEffects(m.overlayKey)).toMatchObject({ layer: "FIREWORKS" });
  });

  it("validates settings and guards the overlay and the creator role", async () => {
    const m = await load();
    expect((await m.saveEffectSettings({ ...settings, emoji: { ...settings.emoji, emojis: ["🐸"] } })).status).toBe("INVALID");
    expect((await m.saveEffectSettings({ ...settings, emoji: { ...settings.emoji, count: 99 } })).status).toBe("INVALID");
    expect((await m.saveEffectSettings({ ...settings, layer: { enabled: true, tiers: [{ minFn: 1, effect: "HEARTS" }, { minFn: 1, effect: "STARS" }] } })).status).toBe("INVALID");
    expect(await m.getOverlayEffects("wrong")).toBe("FORBIDDEN");
    signIn(["SUPPORTER"]);
    expect(await m.saveEffectSettings(settings)).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getEffectSettings()).toBeNull();
  });
});
