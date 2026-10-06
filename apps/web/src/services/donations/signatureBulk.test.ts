import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { priceFromName, signatureNameFrom } from "./signatureTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 일괄 만들기 (code-first, 2026-10-06): library images → signatures, all together or none. */
async function load() {
  const sig = await import("./signatures");
  const core = await import("./signatureCore");
  const assets = await import("@/services/creator/assets");
  return { ...sig, ...core, ...assets };
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const MP3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0];
async function upload(m: Awaited<ReturnType<typeof load>>, n: number, file: string, bytes: number[], type: string) {
  const fd = new FormData();
  fd.set("requestId", key(100 + n));
  fd.set("file", new File([new Uint8Array(bytes)], file, { type }));
  const res = await m.uploadAsset(fd);
  if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
  return res.asset;
}

describe("시그니처 일괄 만들기", () => {
  beforeEach(() => resetMockStores());

  it("suggests a name and a price from the file name", () => {
    expect(priceFromName("1004 하트")).toBe(1004);
    expect(priceFromName("축하_5,000")).toBe(5000);
    expect(priceFromName("1,000,000 대박")).toBe(1_000_000);
    expect(priceFromName("sig-3")).toBeNull(); // under the minimum
    expect(priceFromName("99999999")).toBeNull(); // over the maximum
    expect(priceFromName("하트")).toBeNull();
    expect(signatureNameFrom("  축하 폭죽  ")).toBe("축하 폭죽");
    expect(signatureNameFrom("가".repeat(30))).toBe("가".repeat(20));
    expect(signatureNameFrom(`${"가".repeat(19)} 나`)).toBe("가".repeat(19)); // no trailing space after the cut
  });

  it("adds one signature per row at the end of the list, once per request id", async () => {
    const m = await load();
    const heart = await upload(m, 1, "1004 하트.png", PNG, "image/png");
    const star = await upload(m, 2, "별.png", PNG, "image/png");
    const ding = await upload(m, 3, "1004 하트.mp3", MP3, "audio/mpeg");
    const before = (await m.listSignatures())!.length;
    const req = {
      requestId: key(1),
      match: "AMOUNT",
      active: true,
      rows: [
        { name: "1004 하트", price: 1004, imageUrl: heart.url, soundUrl: ding.url },
        { name: "별", price: 7_777, imageUrl: star.url, soundUrl: null }
      ]
    };
    const res = await m.createSignatures(req);
    if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
    expect(res.ids).toHaveLength(2);
    expect(await m.createSignatures(req)).toEqual(res);
    const list = (await m.listSignatures())!;
    expect(list).toHaveLength(before + 2);
    expect(list.slice(-2)).toMatchObject([
      { id: res.ids[0], name: "1004 하트", price: 1004, imageUrl: heart.url, soundUrl: ding.url, match: "AMOUNT", active: true },
      { id: res.ids[1], name: "별", price: 7_777, soundUrl: null }
    ]);
    // They reach the room panel and the 금액 매칭 like any signature.
    expect(m.getDonationCatalog().signatures.map((s) => s.id)).toEqual(expect.arrayContaining(res.ids));
    expect(m.matchSignatureByAmount(1004)?.id).toBe(res.ids[0]);
    expect(m.signatureSoundFor("SIGNATURE", 1004, { signatureId: res.ids[0] })).toBe(ding.url);
  });

  it("saves nothing when any row is wrong, and says which row", async () => {
    const m = await load();
    const a = await upload(m, 1, "가.png", PNG, "image/png");
    const b = await upload(m, 2, "나.png", PNG, "image/png");
    const existing = (await m.listSignatures())!;
    const ok = { name: "새 시그", price: 1_000, imageUrl: a.url, soundUrl: null };
    const base = { requestId: key(2), match: "SELECT", active: true };
    const bad = async (rows: unknown[], extra: Record<string, unknown> = {}) => m.createSignatures({ ...base, ...extra, rows });

    expect(await bad([ok, { ...ok, name: existing[0].name, imageUrl: b.url }])).toMatchObject({ status: "INVALID", row: 1 });
    expect(await bad([ok, { ...ok, imageUrl: b.url }])).toMatchObject({ status: "INVALID", message: "같은 이름의 시그니처가 있어요.", row: 1 });
    expect(await bad([ok, { ...ok, name: "다른", price: 50 }])).toMatchObject({ status: "INVALID", row: 1 });
    expect(await bad([{ ...ok, imageUrl: "https://evil.example/x.png" }])).toMatchObject({ status: "INVALID", row: 0 });
    expect(await bad([{ ...ok, soundUrl: a.url }])).toMatchObject({ status: "INVALID", row: 0 }); // an image is not a sound
    expect(await bad([{ ...ok, name: "제로투 Zero 2" }])).toMatchObject({ status: "INVALID", row: 0 });
    // One AMOUNT match per price, within the rows and against the list.
    expect(await bad([ok, { ...ok, name: "다른", imageUrl: b.url }], { match: "AMOUNT" })).toMatchObject({ status: "INVALID", row: 1 });
    await m.saveSignature({ ...existing[0], price: 3_000, match: "AMOUNT" });
    expect(await bad([{ ...ok, price: 3_000 }], { match: "AMOUNT" })).toMatchObject({ status: "INVALID", row: 0 });
    // …but hidden or 선택 시에만 rows may share a price.
    expect((await bad([{ ...ok, price: 3_000 }, { ...ok, name: "다른", price: 3_000 }], { match: "AMOUNT", active: false, requestId: key(3) })).status).toBe("SAVED");

    for (const extra of [{ match: "ALL" }, { active: "yes" }, { requestId: "short" }]) expect((await bad([ok], extra)).status).toBe("INVALID");
    expect((await bad([])).status).toBe("INVALID");
    expect((await m.listSignatures())!).toHaveLength(existing.length + 2);
  });

  it("still saves a signature (e.g. 숨기기) after its library image or sound was deleted", async () => {
    const m = await load();
    const img = await upload(m, 1, "축하.png", PNG, "image/png");
    const snd = await upload(m, 2, "축하.mp3", MP3, "audio/mpeg");
    const res = await m.saveSignature({ name: "축하", price: 3_000, imageUrl: img.url, soundUrl: snd.url, match: "SELECT", active: true, requestId: key(70) });
    if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
    await m.deleteAsset(img.id);
    await m.deleteAsset(snd.id);
    const sig = (await m.listSignatures())!.find((s) => s.id === res.id)!;
    // The screen sends the stored values back unchanged: the deleted files fall back instead of failing.
    expect(await m.saveSignature({ ...sig, active: false })).toEqual({ status: "SAVED", id: sig.id });
    expect((await m.listSignatures())!.find((s) => s.id === res.id)).toMatchObject({ active: false, imageUrl: "/mock/room/signatures/sig-1.png", soundUrl: null });
    // A deleted file is still refused when it is not the signature's own.
    const other = (await m.listSignatures())![0];
    expect((await m.saveSignature({ ...other, soundUrl: snd.url })).status).toBe("INVALID");
    expect((await m.saveSignature({ ...other, imageUrl: img.url })).status).toBe("INVALID");
  });

  it("keeps within the signature limit and is for creators only", async () => {
    const m = await load();
    const a = await upload(m, 1, "가.png", PNG, "image/png");
    const room = 50 - (await m.listSignatures())!.length;
    const rows = Array.from({ length: room + 1 }, (_, i) => ({ name: `시그 ${i}`, price: 1_000 + i, imageUrl: a.url }));
    expect(await m.createSignatures({ requestId: key(4), match: "SELECT", active: true, rows })).toMatchObject({ status: "INVALID" });
    expect((await m.createSignatures({ requestId: key(4), match: "SELECT", active: true, rows: rows.slice(0, room) })).status).toBe("SAVED");
    expect((await m.listSignatures())!).toHaveLength(50);
    signIn(["SUPPORTER"]);
    expect(await m.createSignatures({ requestId: key(5), match: "SELECT", active: true, rows: rows.slice(0, 1) })).toEqual({ status: "UNAUTHORIZED" });
  });
});
