import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

const delay = vi.hoisted(() => ({ during: null as null | (() => void) }));
vi.mock("@/lib/mock", () => ({
  USE_MOCK: true,
  mockDelay: () => {
    const run = delay.during;
    delay.during = null;
    run?.();
    return Promise.resolve();
  }
}));
vi.mock("@/lib/session", () => mockSessionModule());

/** 채널 주소 = 후원 페이지 주소: one rule, one reserved list, held old addresses (2026-10-08 결정). */
async function load() {
  const channel = await import("./channel");
  const page = await import("@/services/creator/donationManagement");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  return { ...channel, ...page, mockCreator };
}

const DAY = 86_400_000;

describe("channel address", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => {
    vi.useRealTimers();
    delay.during = null;
  });

  it("uses the 채널 만들기 rule for the 후원 페이지 address", async () => {
    const m = await load();
    expect(await m.checkDonationSlug("my-page")).toEqual({ status: "AVAILABLE" });
    expect(await m.checkDonationSlug("a".repeat(30))).toEqual({ status: "AVAILABLE" });
    const invalid = { status: "INVALID", message: "영문 소문자, 숫자, 하이픈으로 3~30자를 입력해 주세요." };
    for (const bad of ["my_page", "a".repeat(31), "-abc", "abc-", "a--b", "ab", "Abc"]) expect(await m.checkDonationSlug(bad)).toEqual(invalid);
    expect(await m.changeDonationSlug("my-page")).toEqual({ status: "SAVED" });
    expect(m.mockCreator.handle).toBe("my-page");
    expect(await m.checkDonationSlug("my-page")).toEqual({ status: "SAME" });
  });

  it("shares one reserved list between both paths", async () => {
    const m = await load();
    for (const name of ["somnation", "funation", "wallet", "api", "login", "signup", "support", "overlay", "channel", "donation", "creator", "admin", "donate"]) {
      expect(await m.checkDonationSlug(name)).toEqual({ status: "TAKEN" });
      expect(await m.checkChannelSlug(name)).toEqual({ status: "TAKEN" });
    }
    expect(await m.checkChannelSlug("taen")).toEqual({ status: "TAKEN" });
    expect(await m.changeDonationSlug("wallet")).toEqual({ status: "INVALID", message: "이미 사용 중인 주소입니다." });
  });

  it("holds the old address for 30 days: it redirects to the new one and no new channel can take it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
    const m = await load();
    expect(await m.changeDonationSlug("new-home")).toEqual({ status: "SAVED" });
    // The current address, not a hardcoded sample, is taken for a new channel; so is the held old one.
    expect(await m.checkChannelSlug("new-home")).toEqual({ status: "TAKEN" });
    expect(await m.checkChannelSlug("honggildong")).toEqual({ status: "TAKEN" });
    expect(await m.getMovedChannelHandle("honggildong")).toBe("new-home");
    expect(await m.getMovedChannelHandle("new-home")).toBeNull();
    expect(await m.getMovedChannelHandle("someone")).toBeNull();

    // A second change keeps both old addresses pointing to the current one.
    expect(await m.changeDonationSlug("third-home")).toEqual({ status: "SAVED" });
    expect(await m.getMovedChannelHandle("honggildong")).toBe("third-home");
    expect(await m.getMovedChannelHandle("new-home")).toBe("third-home");

    vi.setSystemTime(new Date(Date.parse("2026-10-08T00:00:00Z") + 30 * DAY + 1));
    expect(await m.getMovedChannelHandle("honggildong")).toBeNull();
    expect(await m.checkChannelSlug("honggildong")).toEqual({ status: "AVAILABLE" });
  });

  it("lets the channel take its own old address back", async () => {
    const m = await load();
    await m.changeDonationSlug("new-home");
    expect(await m.checkDonationSlug("honggildong")).toEqual({ status: "AVAILABLE" });
    expect(await m.changeDonationSlug("honggildong")).toEqual({ status: "SAVED" });
    expect(await m.getMovedChannelHandle("new-home")).toBe("honggildong");
    expect(await m.getMovedChannelHandle("honggildong")).toBeNull();
  });

  it("checks the address again in the same tick as the write", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    // Another channel takes the address while 채널 만들기 waits.
    delay.during = () => void (m.mockCreator.handle = "fresh-one");
    expect(await m.createChannel({ slug: "fresh-one", name: "새 채널", intro: "", agreed: true })).toEqual({ status: "SLUG_TAKEN" });
  });
});
