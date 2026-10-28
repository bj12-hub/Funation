import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원랭킹 랭킹제외 · 최고 후원 수동 수정 (2026-10-28, StreamDonate 참고) through the widget settings actions. */
async function load() {
  const widgets = await import("./widgetSettings");
  const { mockAlerts } = await import("./alertCore");
  return { ...widgets, mockAlerts };
}

describe("랭킹제외 · 최고 후원 수동 수정", () => {
  beforeEach(() => resetMockStores());

  it("saves 랭킹제외 by donor key, and checks it", async () => {
    const m = await load();
    const detail = (await m.getWidgetDetail("RANKING"))!;
    expect((detail.settings as { excluded: unknown[] }).excluded).toEqual([]);
    expect(Array.isArray(detail.live.donors)).toBe(true);
    const base = detail.settings as Record<string, unknown>;
    expect(await m.saveWidgetSettings("RANKING", { ...base, excluded: [{ key: "dk-abc", name: " 별빛 " }, { key: "dk-abc", name: "별빛" }] })).toEqual({ status: "SAVED" });
    expect(((await m.getWidgetDetail("RANKING"))!.settings as { excluded: unknown[] }).excluded).toEqual([{ key: "dk-abc", name: "별빛" }]);
    const older = { ...base };
    delete older.excluded;
    expect(await m.saveWidgetSettings("RANKING", older)).toEqual({ status: "SAVED" });
    for (const excluded of [[{ key: "member-1", name: "x" }], [{ key: "dk-abc", name: "" }], "dk-abc", Array.from({ length: 51 }, (_, i) => ({ key: `dk-${i}`, name: "x" }))]) {
      expect((await m.saveWidgetSettings("RANKING", { ...base, excluded })).status).toBe("INVALID");
    }
  });

  it("sets the 현재 최고 후원 by hand, shows it until a bigger donation, and takes it back", async () => {
    const m = await load();
    expect(await m.setTopDonationOverride({ donor: " 직접 ", amount: 99_000_000 })).toMatchObject({ status: "SAVED", top: { donor: "직접", amount: "99,000,000 FN", manual: true } });
    expect((await m.getWidgetDetail("TOP_DONATION"))!.live.topNow).toMatchObject({ donor: "직접", manual: true });
    for (const [input, message] of [
      [{ donor: "", amount: 1_000 }, "후원자를"],
      [{ donor: "가".repeat(21), amount: 1_000 }, "후원자를"],
      [{ donor: "운영자", amount: 1_000 }, "사용할 수 없는"],
      [{ donor: "직접", amount: 0 }, "금액은"],
      [{ donor: "직접", amount: 1.5 }, "금액은"],
      [{ donor: "직접", amount: 100_000_001 }, "금액은"]
    ] as const) {
      const res = await m.setTopDonationOverride(input);
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    const back = await m.setTopDonationOverride(null);
    expect(back.status === "SAVED" && back.top?.manual).toBeFalsy();
    signIn(["SUPPORTER"]);
    expect(await m.setTopDonationOverride({ donor: "직접", amount: 1_000 })).toEqual({ status: "UNAUTHORIZED" });
  });
});
