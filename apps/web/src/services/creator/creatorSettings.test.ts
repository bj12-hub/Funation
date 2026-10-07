import { beforeEach, describe, expect, it, vi } from "vitest";
import { toDateString } from "@/lib/period";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 채널 설정: 주 방송 플랫폼 includes 치지직 (confirmed 2026-10-01); addresses shown on screen use the Somnation name. */
describe("채널 설정", () => {
  beforeEach(() => resetMockStores());

  it("saves 치지직 as the main platform and rejects unknown ones", async () => {
    const m = await import("./creatorSettings");
    expect(await m.setMainPlatform("CHZZK")).toEqual({ status: "SAVED" });
    expect((await m.getCreatorSettings())!.mainPlatform).toBe("CHZZK");
    expect((await m.setMainPlatform("TWITCH")).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect((await m.setMainPlatform("SOOP")).status).toBe("UNAUTHORIZED");
  });

  it("accepts a 데뷔일 only from 1900-01-01 to today", async () => {
    const m = await import("./creatorSettings");
    const { mockCreator } = await import("./mockCreatorStore");
    const base = { birthday: "1990-01-01", birthdayPublic: true, debutPublic: true, anniversaries: [], categories: [] };
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const invalid = { status: "INVALID", message: "방송 데뷔일은 오늘이나 그 이전 날짜로 입력해 주세요." };
    for (const bad of [toDateString(tomorrow), "2999-12-31", "1899-12-31", "1000-01-01"]) expect(await m.saveCreatorProfile({ ...base, debutDate: bad })).toEqual(invalid);
    expect(mockCreator.debutDate).toBe("2020-03-15");
    for (const ok of [toDateString(today), "1900-01-01"]) expect(await m.saveCreatorProfile({ ...base, debutDate: ok })).toEqual({ status: "SAVED" });
  });

  it("shows Somnation addresses", async () => {
    const s = (await (await import("./creatorSettings")).getCreatorSettings())!;
    expect([s.donateUrl, s.rtmpUrl, s.alertWidgetUrl].every((u) => u.includes("somnation.com") && !u.includes("funation"))).toBe(true);
  });
});
