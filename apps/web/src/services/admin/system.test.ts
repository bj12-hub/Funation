import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 플랫폼 연동 · 시스템: adapter status and checks, the site banner the layout shows. */
async function load() {
  const system = await import("./system");
  const { getSiteBanner } = await import("@/services/system/siteBanner");
  const { connectYouTube } = await import("@/services/creator/youtube");
  const { auditEntries } = await import("./auditCore");
  return { ...system, getSiteBanner, connectYouTube, auditEntries };
}

describe("admin platforms and system", () => {
  beforeEach(() => resetMockStores());

  it("reports capabilities, the studio connection and connection checks", async () => {
    const m = await load();
    signIn(["CREATOR"]);
    await m.connectYouTube({ handle: "adminview", requestId: key(1) });
    signIn(["ADMIN"]);
    const rows = (await m.getPlatformStatus())!;
    expect(rows.map((r) => r.platform)).toEqual(["YOUTUBE", "CHZZK", "SOOP", "FLEXTV"]);
    expect(rows[0].capabilities).toEqual(expect.arrayContaining(["DONATION_EVENTS", "CHAT_EVENTS", "CHAT_SEND", "CHAT_MODERATE"]));
    expect(rows[0].unverified).toEqual([]);
    expect(rows[0].connection).toMatchObject({ connected: true, videoCount: 8 });
    expect(rows[2].capabilities).not.toContain("CHAT_MODERATE");
    expect(rows[2].unverified).toContain("CHAT_EVENTS");
    expect(rows[2].connection.connected).toBe(false);

    await m.checkPlatform("YOUTUBE");
    await m.checkPlatform("SOOP");
    const after = (await m.getPlatformStatus())!;
    expect(after[0].lastCheck).toMatchObject({ ok: true, error: null });
    expect(after[2].lastCheck).toMatchObject({ ok: true, error: null });
    expect((await m.checkPlatform("TWITCH")).status).toBe("INVALID");
  });

  it("shows the site banner only while enabled and audits changes", async () => {
    const m = await load();
    signIn(["ADMIN"]);
    expect(await m.getSiteBanner()).toBeNull();
    expect((await m.saveSiteBanner(OP, { enabled: true, level: "WARNING", message: "", href: "" })).status).toBe("INVALID");
    expect((await m.saveSiteBanner(OP, { enabled: true, level: "WARNING", message: "점검 안내", href: "https://evil.example" })).status).toBe("INVALID");
    expect(await m.saveSiteBanner(OP, { enabled: true, level: "WARNING", message: "점검 안내", href: "/support" })).toEqual({ status: "OK" });
    expect(await m.getSiteBanner()).toEqual({ level: "WARNING", message: "점검 안내", href: "/support" });
    await m.saveSiteBanner(OP, { enabled: false, level: "INFO", message: "점검 안내", href: "" });
    expect(await m.getSiteBanner()).toBeNull();
    expect(m.auditEntries().map((e) => e.action)).toEqual(["SYSTEM_UPDATE", "SYSTEM_UPDATE"]);
    expect((await m.getSystemView())!.runtime).toMatchObject({ mock: true, auditEntries: 2 });
  });

});
