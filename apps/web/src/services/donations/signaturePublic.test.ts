import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 공개 시그니처 페이지 · 시그니처 ZIP (2026-10-25, StreamDonate 시그니처 관리 참고). */
async function load() {
  const actions = await import("./signatures");
  const core = await import("./signatureCore");
  const { mockAssets } = await import("@/services/creator/assetCore");
  return { ...actions, ...core, mockAssets };
}

const OP = { userId: "admin-1", nickname: "운영자1" };
const keyOf = (path: string) => path.split("/").pop()!;

/** Reads a stored ZIP's names and bytes back through its central directory. */
function entries(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  let at = v.getUint32(end + 16, true);
  const out: Record<string, Uint8Array> = {};
  for (let i = 0; i < v.getUint16(end + 10, true); i++) {
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
    const start = local + 30 + v.getUint16(local + 26, true);
    out[name] = zip.subarray(start, start + size);
    at += 46 + nameLen;
  }
  return out;
}

describe("공개 시그니처 페이지", () => {
  beforeEach(() => resetMockStores());

  it("opens only while on, with its current key, showing the active signatures", async () => {
    const m = await load();
    const page = (await m.getSignaturePage())!;
    expect(page).toMatchObject({ enabled: false });
    expect(page.path).toMatch(/^\/signatures\/[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
    const first = keyOf(page.path);
    expect(m.publicSignaturePage(first)).toBeNull(); // off

    expect(await m.setSignaturePageEnabled({ enabled: true })).toEqual({ status: "SAVED", id: "public-page" });
    m.mockSignatures.items[1].active = false; // 숨김
    const shown = m.publicSignaturePage(first)!;
    expect(shown.channelName).toBe("홍길동의 방송");
    expect(shown.signatures.map((s) => s.id)).toEqual(m.mockSignatures.items.filter((s) => s.active).map((s) => s.id));
    expect(shown.signatures[0]).toMatchObject({ imageUrl: m.mockSignatures.items[0].imageUrl, soundUrl: null, group: "기본" });
    expect(shown.groups).toEqual(["기본"]);
    expect(m.publicSignaturePage("abcd-abcd-abcd-abcd")).toBeNull();
    expect(m.publicSignaturePage(undefined)).toBeNull();

    // 재발급: the old address stops, the new one opens; on/off stays.
    expect(await m.reissueSignaturePageKey()).toEqual({ status: "SAVED", id: "public-page" });
    const next = (await m.getSignaturePage())!;
    expect(next.enabled).toBe(true);
    expect(m.publicSignaturePage(first)).toBeNull();
    expect(m.publicSignaturePage(keyOf(next.path))).not.toBeNull();

    // 이용 정지: closed like the other links, open again once lifted.
    const admin = await import("@/services/admin/members");
    const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
    expect(await admin.suspendMember(OP, { id: SAMPLE_MEMBER_ID, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(1) })).toEqual({ status: "OK" });
    expect(m.publicSignaturePage(keyOf(next.path))).toBeNull();

    expect((await m.setSignaturePageEnabled({ enabled: "yes" })).status).toBe("INVALID");
  });

  it("is the creator's to change", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.getSignaturePage()).toBeNull();
    expect(await m.setSignaturePageEnabled({ enabled: true })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.reissueSignaturePageKey()).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("시그니처 ZIP", () => {
  beforeEach(() => resetMockStores());

  it("holds every signature's image and sound and the list as CSV", async () => {
    const m = await load();
    const [a, b] = m.mockSignatures.items;
    // b gets a library sound; a deleted library image falls back to the first preset, as alerts do.
    const sound = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
    m.mockAssets.items.push({ id: "11111111-2222-4333-8444-555555555555", kind: "SOUND", name: "빵빠레", mime: "audio/mpeg", size: sound.length, url: "/api/media/11111111-2222-4333-8444-555555555555", uploadedAt: new Date().toISOString(), bytes: sound });
    b.soundUrl = "/api/media/11111111-2222-4333-8444-555555555555";
    b.active = false;
    b.name = 'Hold/up "2"';
    a.imageUrl = "/api/media/00000000-0000-4000-8000-000000000000"; // deleted

    const { bytes, count } = await m.signatureArchive();
    expect(count).toBe(m.mockSignatures.items.length);
    const files = entries(bytes);
    const names = Object.keys(files);
    expect(names[0]).toBe(`01_${a.name}_${a.price}FN.png`);
    expect(names).toContain(`02_Hold_up _2__${b.price}FN.png`);
    expect([...files["02_Hold_up _2__사운드.mp3"]]).toEqual([...sound]);
    expect(names.at(-1)).toBe("시그니처 목록.csv");
    // Image bytes are the preset files themselves (PNG signature).
    expect([...files[names[0]].subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const csv = new TextDecoder().decode(files["시그니처 목록.csv"]).replace("﻿", "").split("\r\n");
    expect(csv[0]).toBe("순서,이름,가격(FN),그룹,사용,매칭,금액범위 시작,이미지 파일,사운드 파일");
    expect(csv[2]).toBe(`2,"Hold/up ""2""",${b.price},기본,숨김,선택 시에만,,02_Hold_up _2__${b.price}FN.png,02_Hold_up _2__사운드.mp3`);
    expect(csv).toHaveLength(m.mockSignatures.items.length + 1);
  });

  it("is served to the creator only, as an attachment that is never cached", async () => {
    const { GET } = await import("@/app/api/creator/signatures/zip/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("attachment;");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await res.arrayBuffer()).subarray(0, 4)).toEqual(new Uint8Array([0x50, 0x4b, 3, 4]));
    signIn(["SUPPORTER"]);
    expect((await GET()).status).toBe(401);
  });
});
