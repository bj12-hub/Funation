import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * Writes that await (reading the file, the mock delay) check the store again after the last await and write in the
 * same tick: concurrent requests never lose each other's adds, bring a deleted item back or pass a cap together.
 */
async function load() {
  const widgets = await import("./widgetSettings");
  const assets = await import("./assets");
  const page = await import("./donationManagement");
  const { readWidget } = await import("./widgetStore");
  const { mockAssets } = await import("./assetCore");
  const types = await import("./widgetSettingsTypes");
  const { ASSET_LIMITS } = await import("./assetTypes");
  return { ...widgets, ...assets, ...page, readWidget, mockAssets, ...types, ASSET_LIMITS };
}

const MP3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const soundForm = (word: string, id = "") => {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("word", word);
  fd.set("volume", "50");
  if (!id) fd.set("file", new File([new Uint8Array(MP3)], `${word}.mp3`, { type: "audio/mpeg" }));
  return fd;
};
const imageForm = (field: string, n = 0) => {
  const fd = new FormData();
  fd.set("requestId", key(n));
  fd.set(field, new File([new Uint8Array(PNG)], `img-${n}.png`, { type: "image/png" }));
  return fd;
};

describe("concurrent studio writes", () => {
  beforeEach(() => resetMockStores());

  it("keeps both of two custom sounds added at once", async () => {
    const m = await load();
    const before = m.readWidget("CUSTOM_SOUND").sounds.length;
    const [a, b] = await Promise.all([m.saveCustomSound(soundForm("하나")), m.saveCustomSound(soundForm("둘"))]);
    expect([a.status, b.status]).toEqual(["SAVED", "SAVED"]);
    expect(m.readWidget("CUSTOM_SOUND").sounds.map((s) => s.word).slice(before)).toEqual(["하나", "둘"]);
  });

  it("refuses the same word, or a sound past the cap, when two arrive at once", async () => {
    const m = await load();
    const same = await Promise.all([m.saveCustomSound(soundForm("같은말")), m.saveCustomSound(soundForm("같은말"))]);
    expect(same.map((r) => r.status).sort()).toEqual(["INVALID", "SAVED"]);
    for (let i = m.readWidget("CUSTOM_SOUND").sounds.length; i < m.CUSTOM_SOUND_MAX - 1; i++) expect((await m.saveCustomSound(soundForm(`채움${i}`))).status).toBe("SAVED");
    const last = await Promise.all([m.saveCustomSound(soundForm("마지막1")), m.saveCustomSound(soundForm("마지막2"))]);
    expect(last.map((r) => r.status).sort()).toEqual(["INVALID", "SAVED"]);
    expect(m.readWidget("CUSTOM_SOUND").sounds).toHaveLength(m.CUSTOM_SOUND_MAX);
  });

  it("never brings back a sound deleted while it was being edited", async () => {
    const m = await load();
    const added = await m.saveCustomSound(soundForm("지울말"));
    if (added.status !== "SAVED") throw new Error(added.status);
    const [, edit] = await Promise.all([m.deleteCustomSound(added.sound.id), m.saveCustomSound(soundForm("고친말", added.sound.id))]);
    expect(edit).toEqual({ status: "INVALID", message: "삭제되었거나 없는 사운드입니다." });
    expect(m.readWidget("CUSTOM_SOUND").sounds.some((s) => s.id === added.sound.id)).toBe(false);
  });

  it("keeps the wallpaper image cap with concurrent uploads", async () => {
    const m = await load();
    for (let i = m.readWidget("WALLPAPER").images.length; i < m.WALLPAPER_IMAGES_MAX - 1; i++) expect((await m.uploadWallpaperImage(imageForm("image"))).status).toBe("UPLOADED");
    const both = await Promise.all([m.uploadWallpaperImage(imageForm("image")), m.uploadWallpaperImage(imageForm("image"))]);
    expect(both.map((r) => r.status).sort()).toEqual(["LIMIT", "UPLOADED"]);
    expect(m.readWidget("WALLPAPER").images).toHaveLength(m.WALLPAPER_IMAGES_MAX);
  });

  it("keeps the library count cap with concurrent uploads", async () => {
    const m = await load();
    for (let i = m.mockAssets.items.length; i < m.ASSET_LIMITS.max - 1; i++) expect((await m.uploadAsset(imageForm("file", 100 + i))).status).toBe("SAVED");
    const both = await Promise.all([m.uploadAsset(imageForm("file", 1)), m.uploadAsset(imageForm("file", 2))]);
    expect(both.map((r) => r.status).sort()).toEqual(["INVALID", "SAVED"]);
    expect(m.mockAssets.items).toHaveLength(m.ASSET_LIMITS.max);
  });

  it("adds a 금지어 or 필터 단어 once when it is submitted twice at once", async () => {
    const m = await load();
    const banned = await Promise.all([m.addBannedWord("두번"), m.addBannedWord("두번")]);
    expect(banned).toEqual([{ status: "SAVED" }, { status: "INVALID", message: "이미 등록된 금지어입니다." }]);
    const filtered = await Promise.all([m.addFilterWord("두번"), m.addFilterWord("두번")]);
    expect(filtered).toEqual([{ status: "SAVED" }, { status: "INVALID", message: "이미 등록된 단어입니다." }]);
    const page = (await m.getDonationPageSettings())!;
    expect(page.replacement.bannedWords.filter((w) => w === "두번")).toHaveLength(1);
  });
});
