import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { mediaGapsOf } from "./signatureTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 미디어 누락 (2026-10-25, StreamDonate 시그니처 관리 참고): the list says where each signature's media stands. */
async function load() {
  const actions = await import("./signatures");
  const core = await import("./signatureCore");
  const { mockAssets } = await import("@/services/creator/assetCore");
  return { ...actions, ...core, mockAssets };
}

const asset = (id: string, kind: "IMAGE" | "SOUND") => ({ id, kind, name: id, mime: kind === "IMAGE" ? "image/png" : "audio/mpeg", size: 1, url: `/api/media/${id}`, uploadedAt: new Date().toISOString(), bytes: Buffer.from([1]) });
const IMG = "11111111-2222-4333-8444-555555555555";
const SND = "66666666-7777-4888-9999-000000000000";

describe("미디어 누락", () => {
  beforeEach(() => resetMockStores());

  it("marks deleted library images and sounds, and signatures without a sound, by the rules alerts use", async () => {
    const m = await load();
    m.mockAssets.items.push(asset(IMG, "IMAGE"), asset(SND, "SOUND"));
    const [a, b, c] = m.mockSignatures.items;
    Object.assign(a, { imageUrl: `/api/media/${IMG}`, soundUrl: `/api/media/${SND}` }); // both in the library
    Object.assign(b, { imageUrl: "/api/media/00000000-0000-4000-8000-000000000000", soundUrl: "/api/media/00000000-0000-4000-8000-000000000001" }); // both deleted
    Object.assign(c, { soundUrl: null }); // a preset image, no sound

    const rows = (await m.listSignatures())!;
    expect(rows.map((r) => r.id)).toEqual(m.mockSignatures.items.map((s) => s.id));
    expect(rows[0].media).toEqual({ image: "OK", sound: "OK" });
    expect(rows[1].media).toEqual({ image: "MISSING", sound: "MISSING" });
    expect(rows[2].media).toEqual({ image: "OK", sound: "NONE" });
    // What alerts do with them: the first preset, and no sound.
    expect(m.signatureImageOf(b)).toBe("/mock/room/signatures/sig-1.png");
    expect(m.signatureSoundOf(b)).toBeUndefined();

    // A library sound used as an image (or the other way round) does not count.
    Object.assign(a, { imageUrl: `/api/media/${SND}` });
    expect((await m.listSignatures())![0].media.image).toBe("MISSING");
    // Rows carry the media for the screen only: saving one back stores none of it.
    expect(await m.saveSignature({ ...rows[2], active: false })).toMatchObject({ status: "SAVED" });
    expect(m.mockSignatures.items[2]).not.toHaveProperty("media");
  });

  it("lists the kinds of gap a row has", () => {
    expect(mediaGapsOf({ image: "OK", sound: "OK" })).toEqual([]);
    expect(mediaGapsOf({ image: "MISSING", sound: "MISSING" })).toEqual(["IMAGE_MISSING", "SOUND_MISSING"]);
    expect(mediaGapsOf({ image: "OK", sound: "NONE" })).toEqual(["SOUND_NONE"]);
  });

  it("is the creator's", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.listSignatures()).toBeNull();
  });
});
