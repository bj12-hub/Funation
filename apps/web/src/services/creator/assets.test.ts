import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 이미지·사운드 라이브러리 → 배너 · 시그니처: uploads are type-checked by content, widgets skip deleted files. */
async function load() {
  const assets = await import("./assets");
  const banner = await import("./banner");
  const sig = await import("@/services/donations/signatures");
  const sigCore = await import("@/services/donations/signatureCore");
  const route = await import("@/app/api/media/[id]/route");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...assets, ...banner, ...sig, ...sigCore, GET: route.GET, overlayKey: mockCreator.integrationKey };
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const form = (n: number, bytes: number[], type: string, name = "file.png") => {
  const fd = new FormData();
  fd.set("requestId", key(n));
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return fd;
};

async function uploadImage(m: Awaited<ReturnType<typeof load>>, n: number) {
  const res = await m.uploadAsset(form(n, PNG, "image/png", `slide-${n}.png`));
  if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
  return res.asset;
}

describe("asset library", () => {
  beforeEach(() => resetMockStores());

  it("never answers another account's request id with their file", async () => {
    const m = await load();
    const mine = await uploadImage(m, 1);
    signInAs("u-other");
    const theirs = await m.uploadAsset(form(1, PNG, "image/png", "other.png"));
    expect(theirs).toMatchObject({ status: "SAVED", asset: { name: "other" } });
    expect(theirs.status === "SAVED" && theirs.asset.id).not.toBe(mine.id);
  });

  it("uploads once per request id, serves the bytes and rejects files whose content does not match", async () => {
    const m = await load();
    const a = await uploadImage(m, 1);
    expect(await m.uploadAsset(form(1, PNG, "image/png"))).toEqual({ status: "SAVED", asset: a });
    expect(a).toMatchObject({ kind: "IMAGE", name: "slide-1", mime: "image/png", url: `/api/media/${a.id}` });

    const res = await m.GET(new Request("http://x"), { params: Promise.resolve({ id: a.id }) });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(PNG));

    expect((await m.uploadAsset(form(2, [0x3c, 0x73, 0x76, 0x67], "image/png"))).status).toBe("INVALID");
    expect((await m.uploadAsset(form(3, [0x3c, 0x73, 0x76, 0x67], "image/svg+xml", "x.svg"))).status).toBe("INVALID");
    expect((await m.uploadAsset(form(4, [0x49, 0x44, 0x33, 4, 0], "audio/mpeg", "beep.mp3"))).status).toBe("SAVED");
    expect(await m.listAssets("SOUND")).toHaveLength(1);

    await m.renameAsset({ id: a.id, name: "메인 배너" });
    expect((await m.listAssets("IMAGE"))![0].name).toBe("메인 배너");
    await m.deleteAsset(a.id);
    expect((await m.GET(new Request("http://x"), { params: Promise.resolve({ id: a.id }) })).status).toBe(404);
  });

  it("builds a banner from library images and skips deleted slides", async () => {
    const m = await load();
    const a = await uploadImage(m, 5);
    const b = await uploadImage(m, 6);
    expect((await m.saveBannerSettings({ enabled: true, position: "TOP", intervalSec: 5, slides: [] })).status).toBe("INVALID");
    expect((await m.saveBannerSettings({ enabled: true, position: "TOP", intervalSec: 5, slides: ["nope"] })).status).toBe("INVALID");
    expect((await m.saveBannerSettings({ enabled: true, position: "TOP", intervalSec: 1, slides: [a.id] })).status).toBe("INVALID");
    expect(await m.saveBannerSettings({ enabled: true, position: "TOP", intervalSec: 5, slides: [a.id, b.id] })).toEqual({ status: "SAVED" });

    expect(await m.getOverlayBanner(m.overlayKey)).toMatchObject({ enabled: true, position: "TOP", slides: [{ id: a.id }, { id: b.id }] });
    await m.deleteAsset(a.id);
    expect(await m.getOverlayBanner(m.overlayKey)).toMatchObject({ slides: [{ id: b.id }] });
    await m.deleteAsset(b.id);
    expect(await m.getOverlayBanner(m.overlayKey)).toMatchObject({ enabled: false, slides: [] });
    expect(await m.getOverlayBanner("wrong")).toBe("FORBIDDEN");
  });

  it("lets a signature use a library image and falls back to a preset after deletion", async () => {
    const m = await load();
    const a = await uploadImage(m, 7);
    const zero = (await m.listSignatures())![0];
    expect(await m.saveSignature({ ...zero, imageUrl: a.url })).toMatchObject({ status: "SAVED" });
    expect(m.activeSignatures()[0].imageUrl).toBe(a.url);
    await m.deleteAsset(a.id);
    expect(m.activeSignatures()[0].imageUrl).toBe("/mock/room/signatures/sig-1.png");
    // Its own deleted image no longer blocks a save (e.g. 숨기기): it is stored as the preset it already shows.
    expect(await m.saveSignature({ ...zero, imageUrl: a.url })).toMatchObject({ status: "SAVED" });
    expect((await m.listSignatures())![0].imageUrl).toBe("/mock/room/signatures/sig-1.png");
    // Another signature cannot pick the deleted file.
    const one = (await m.listSignatures())![1];
    expect((await m.saveSignature({ ...one, imageUrl: a.url })).status).toBe("INVALID");
  });

  it("gives an amount-matched 일반 후원 the preset image once its library image is deleted, like a 시그니처 후원", async () => {
    const m = await load();
    const a = await uploadImage(m, 8);
    const saved = await m.saveSignature({ name: "금액 시그", price: 7_777, imageUrl: a.url, match: "AMOUNT", active: true, requestId: key(17) });
    if (saved.status !== "SAVED") throw new Error(saved.status);
    expect(m.signatureImageFor(m.getDonationCatalog(), "TEXT", 7_777, null)).toBe(a.url);
    await m.deleteAsset(a.id);
    expect(m.signatureImageFor(m.getDonationCatalog(), "TEXT", 7_777, null)).toBe("/mock/room/signatures/sig-1.png");
    expect(m.signatureImageFor(m.getDonationCatalog(), "SIGNATURE", 7_777, { signatureId: saved.id })).toBe("/mock/room/signatures/sig-1.png");
    expect(m.signatureImageFor(m.getDonationCatalog(), "TEXT", 7_778, null)).toBeUndefined();
  });

  it("pairs an image and a sound with the same name and lets a signature carry only a library sound", async () => {
    const m = await load();
    const { pairOf } = await import("./assetTypes");
    const MP3 = [0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0];
    const img = await m.uploadAsset(form(11, PNG, "image/png", "축하.png"));
    const snd = await m.uploadAsset(form(12, MP3, "audio/mpeg", " 축하 .mp3"));
    const other = await m.uploadAsset(form(13, MP3, "audio/mpeg", "박수.mp3"));
    if (img.status !== "SAVED" || snd.status !== "SAVED" || other.status !== "SAVED") throw new Error("upload");
    const library = (await m.listAssets())!;
    expect(pairOf(img.asset, library)?.id).toBe(snd.asset.id);
    expect(pairOf(snd.asset, library)?.id).toBe(img.asset.id);
    expect(pairOf(other.asset, library)).toBeNull();

    const base = { name: "축하 시그", price: 7_000, imageUrl: img.asset.url, match: "SELECT", active: true };
    const saved = await m.saveSignature({ ...base, soundUrl: snd.asset.url, requestId: key(14) });
    expect(saved.status).toBe("SAVED");
    expect((await m.listSignatures())!.find((s) => s.name === "축하 시그")!.soundUrl).toBe(snd.asset.url);
    for (const bad of [img.asset.url, "https://evil.example/a.mp3", "/api/media/nope", 3]) {
      expect((await m.saveSignature({ ...base, name: "다른 시그", soundUrl: bad, requestId: key(15) })).status).toBe("INVALID");
    }
    // No sound given = none (older clients).
    expect((await m.saveSignature({ ...base, name: "무음 시그", requestId: key(16) })).status).toBe("SAVED");
    expect((await m.listSignatures())!.find((s) => s.name === "무음 시그")!.soundUrl).toBeNull();
    // A deleted sound no longer counts.
    await m.deleteAsset(snd.asset.id);
    expect(m.isSignatureSound(snd.asset.url)).toBe(false);
  });

  it("plays the chosen signature's sound with its alert at 시그니처 볼륨", async () => {
    const m = await load();
    const alerts = await import("./alertRemote");
    const MP3 = [0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0];
    const snd = await m.uploadAsset(form(21, MP3, "audio/mpeg", "팡파레.mp3"));
    if (snd.status !== "SAVED") throw new Error("upload");
    const sig = m.mockSignatures.items[0];
    sig.soundUrl = snd.asset.url;
    expect(m.signatureSoundFor("SIGNATURE", sig.price, { signatureId: sig.id })).toBe(snd.asset.url);
    expect(m.signatureSoundFor("SIGNATURE", sig.price, { signatureId: "nope" })).toBeUndefined();
    expect(m.signatureSoundFor("TEXT", sig.price, {})).toBeUndefined(); // not an AMOUNT match yet
    sig.match = "AMOUNT";
    expect(m.signatureSoundFor("TEXT", sig.price, {})).toBe(snd.asset.url);
    sig.active = false;
    expect(m.signatureSoundFor("SIGNATURE", sig.price, { signatureId: sig.id })).toBeUndefined();

    expect((await alerts.setAlertControls({ signatureVolume: 35 })).status).toBe("SAVED");
    for (const bad of [-1, 101, 2.5, "50"]) expect((await alerts.setAlertControls({ signatureVolume: bad })).status).toBe("INVALID");
    const overlay = await alerts.getOverlayAlert(m.overlayKey);
    if (overlay === "FORBIDDEN") throw new Error("key");
    expect(overlay.controls.signatureVolume).toBe(35);
  });

  it("stores names in NFC on upload and rename", async () => {
    const m = await load();
    const nfd = "가을 배경".normalize("NFD");
    const up = await m.uploadAsset(form(30, PNG, "image/png", `${nfd}.png`));
    expect(up).toMatchObject({ status: "SAVED", asset: { name: "가을 배경" } });
    if (up.status !== "SAVED") throw new Error(up.status);
    expect(await m.renameAsset({ id: up.asset.id, name: "축하".normalize("NFD") })).toMatchObject({ status: "SAVED", asset: { name: "축하" } });
  });

  it("requires the creator role", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.uploadAsset(form(8, PNG, "image/png"))).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.listAssets()).toBeNull();
    expect(await m.getBannerSettings()).toBeNull();
  });
});
