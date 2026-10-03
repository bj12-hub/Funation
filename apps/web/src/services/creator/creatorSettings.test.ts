import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("shows Somnation addresses", async () => {
    const s = (await (await import("./creatorSettings")).getCreatorSettings())!;
    expect([s.donateUrl, s.rtmpUrl, s.alertWidgetUrl].every((u) => u.includes("somnation.com") && !u.includes("funation"))).toBe(true);
  });
});
