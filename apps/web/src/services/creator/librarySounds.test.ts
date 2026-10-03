import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 이미지·사운드 → 커스텀 사운드 "라이브러리" · 뽑기 "효과음 설정" (code-first). */
async function load() {
  const assets = await import("./assets");
  const widgets = await import("./widgetSettings");
  return { ...assets, ...widgets };
}

const MP3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0];
async function uploadSound(m: Awaited<ReturnType<typeof load>>, n: number, name: string) {
  const fd = new FormData();
  fd.set("requestId", key(n));
  fd.set("file", new File([new Uint8Array(MP3)], `${name}.mp3`, { type: "audio/mpeg" }));
  const res = await m.uploadAsset(fd);
  if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
  return res.asset;
}

const soundForm = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ id: "", volume: "50", ...fields })) fd.set(k, v);
  return fd;
};

describe("라이브러리 사운드", () => {
  beforeEach(() => resetMockStores());

  it("copies a library sound into a custom sound, so deleting it from the library keeps the sound", async () => {
    const m = await load();
    const beep = await uploadSound(m, 1, "beep");
    expect((await m.saveCustomSound(soundForm({ word: "안녕", assetId: "nope" }))).status).toBe("INVALID");
    const res = await m.saveCustomSound(soundForm({ word: "안녕", assetId: beep.id }));
    if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
    expect(res.sound).toMatchObject({ word: "안녕", fileName: "beep" });
    expect(res.sound.fileUrl.startsWith("data:audio/mpeg;base64,")).toBe(true);
    await m.deleteAsset(beep.id);
    const detail = await m.getWidgetDetail("CUSTOM_SOUND");
    expect(detail?.settings).toMatchObject({ sounds: [{ word: "안녕", fileUrl: res.sound.fileUrl }] });
  });

  it("saves a 뽑기 당첨 효과음 only from the library and reads a deleted one as none", async () => {
    const m = await load();
    const win = await uploadSound(m, 2, "win");
    const gacha = (await m.getWidgetDetail("GACHA"))!.settings as { gachas: { winSoundId: string | null }[] };
    expect(gacha.gachas[0].winSoundId).toBeNull();
    const withSound = (id: string) => ({ ...gacha, gachas: gacha.gachas.map((g, i) => (i === 0 ? { ...g, winSoundId: id } : g)) });
    expect((await m.saveWidgetSettings("GACHA", withSound("missing-id"))).status).toBe("INVALID");
    expect(await m.saveWidgetSettings("GACHA", withSound(win.id))).toEqual({ status: "SAVED" });
    expect(((await m.getWidgetDetail("GACHA"))!.settings as typeof gacha).gachas[0].winSoundId).toBe(win.id);
    await m.deleteAsset(win.id);
    expect(((await m.getWidgetDetail("GACHA"))!.settings as typeof gacha).gachas[0].winSoundId).toBeNull();
  });

  it("checks the bytes of uploaded sounds and wallpaper images, not just the declared type", async () => {
    const m = await load();
    const fake = soundForm({ word: "가짜" });
    fake.set("file", new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67])], "x.mp3", { type: "audio/mpeg" }));
    expect(await m.saveCustomSound(fake)).toMatchObject({ status: "INVALID", message: "파일 내용이 형식과 맞지 않아요." });
    const real = soundForm({ word: "진짜" });
    real.set("file", new File([new Uint8Array(MP3)], "x.mp3", { type: "audio/mpeg" }));
    expect((await m.saveCustomSound(real)).status).toBe("SAVED");

    const image = (bytes: number[], type: string) => {
      const fd = new FormData();
      fd.set("image", new File([new Uint8Array(bytes)], "wp.png", { type }));
      return fd;
    };
    expect(await m.uploadWallpaperImage(image([0x3c, 0x73, 0x76, 0x67], "image/png"))).toEqual({ status: "UNSUPPORTED" });
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
    expect((await m.uploadWallpaperImage(image(png, "image/png"))).status).toBe("UPLOADED");
  });
});
