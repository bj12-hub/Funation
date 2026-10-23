import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { amountConflict, spanText, type ManagedSignature } from "./signatureTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 금액범위 · 그룹 (2026-10-23, StreamDonate 참고, P1-6). */
async function load() {
  const sig = await import("./signatures");
  const core = await import("./signatureCore");
  return { ...sig, ...core };
}

const draft = { name: "범위 시그", price: 10_000, imageUrl: "/mock/room/signatures/sig-3.png", match: "AMOUNT", active: true };
const sig = (id: string, price: number, rangeMin: number | null, patch: Partial<ManagedSignature> = {}): ManagedSignature => ({
  id,
  name: id,
  price,
  rangeMin,
  imageUrl: "",
  soundUrl: null,
  match: "AMOUNT",
  active: true,
  group: "기본",
  ...patch
});

describe("시그니처 금액범위", () => {
  beforeEach(() => resetMockStores());

  it("finds overlapping amounts among active 금액 일치 signatures only", () => {
    expect(amountConflict([sig("a", 10_000, 9_000), sig("b", 9_000, null)])?.map((s) => s.id)).toEqual(["a", "b"]);
    expect(amountConflict([sig("a", 10_000, 9_000), sig("b", 8_999, 5_000)])).toBeNull();
    expect(amountConflict([sig("a", 10_000, 9_000), sig("b", 9_500, null, { active: false })])).toBeNull();
    expect(amountConflict([sig("a", 10_000, 9_000), sig("b", 9_500, null, { match: "SELECT" })])).toBeNull();
    expect(spanText(sig("a", 10_000, 9_000))).toBe("9,000 ~ 10,000 FN");
    expect(spanText(sig("a", 10_000, null))).toBe("10,000 FN");
  });

  it("matches a 일반 후원 anywhere in the range and keeps two signatures from sharing an amount", async () => {
    const m = await load();
    const saved = await m.saveSignature({ ...draft, rangeMin: 9_000, group: " 이벤트 ", requestId: key(1) });
    if (saved.status !== "SAVED") throw new Error(JSON.stringify(saved));
    for (const amount of [9_000, 9_999, 10_000]) expect(m.matchSignatureByAmount(amount)?.id).toBe(saved.id);
    expect(m.matchSignatureByAmount(8_999)).toBeNull();
    expect(m.signatureIdFor("TEXT", 9_500, null)).toBe(saved.id);
    expect(m.signatureIdFor("SIGNATURE", 9_500, { signatureId: "sig-x" })).toBe("sig-x");
    expect(m.signatureIdFor("MINI", 9_500, null)).toBeUndefined();
    expect((await m.listSignatures())!.find((s) => s.id === saved.id)).toMatchObject({ rangeMin: 9_000, group: "이벤트" });

    // Another signature's price or range inside 9,000 ~ 10,000 is refused, naming the one it clashes with.
    const clash = await m.saveSignature({ ...draft, name: "겹침", price: 9_500, requestId: key(2) });
    expect(clash).toEqual({ status: "INVALID", message: "금액 매칭이 '범위 시그'(9,000 ~ 10,000 FN)와 겹쳐요. 가격이나 금액범위를 바꿔 주세요." });
    expect((await m.saveSignature({ ...draft, name: "겹침", price: 12_000, rangeMin: 10_000, requestId: key(3) })).status).toBe("INVALID");
    expect((await m.saveSignature({ ...draft, name: "옆", price: 12_000, rangeMin: 10_001, requestId: key(4) })).status).toBe("SAVED");
    // Hidden or 선택할 때만 signatures take no amount.
    expect((await m.saveSignature({ ...draft, name: "숨김", price: 9_500, active: false, requestId: key(5) })).status).toBe("SAVED");
    expect((await m.saveSignature({ ...draft, name: "선택", price: 9_500, match: "SELECT", rangeMin: 9_000, requestId: key(6) })).status).toBe("SAVED");
    // 선택할 때만 keeps no range.
    expect((await m.listSignatures())!.find((s) => s.name === "선택")!.rangeMin).toBeNull();
    // Editing a signature does not clash with itself.
    expect((await m.saveSignature({ ...draft, id: saved.id, rangeMin: 8_000 })).status).toBe("SAVED");

    // 일괄 만들기 checks its rows against the ranges too.
    const bulk = await m.createSignatures({ requestId: key(7), match: "AMOUNT", active: true, group: "", rows: [{ ...draft, name: "일괄", price: 8_500 }] });
    expect(bulk).toMatchObject({ status: "INVALID", row: 0 });
    expect(bulk.status === "INVALID" && bulk.message).toContain("'범위 시그'(8,000 ~ 10,000 FN)");
  });

  it("validates the range and the group", async () => {
    const m = await load();
    for (const rangeMin of [10_000, 99, 9_000.5, "9000"]) {
      const res = await m.saveSignature({ ...draft, rangeMin, requestId: key(10) });
      expect(res.status === "INVALID" && res.message, String(rangeMin)).toContain("금액범위");
    }
    const long = await m.saveSignature({ ...draft, group: "가".repeat(11), requestId: key(11) });
    expect(long.status === "INVALID" && long.message).toContain("그룹 이름");
    // Signatures saved before 그룹 · 금액범위 read as 기본 · 가격만.
    expect((await m.listSignatures())!.every((s) => s.group === "기본" && s.rangeMin === null)).toBe(true);
  });
});

describe("시그니처 그룹", () => {
  beforeEach(() => resetMockStores());

  it("shows or hides a whole group, refusing to show one that would clash", async () => {
    const m = await load();
    const ids: string[] = [];
    for (const [i, row] of [
      { name: "이벤트1", price: 3_000 },
      { name: "이벤트2", price: 4_000 }
    ].entries()) {
      const res = await m.saveSignature({ ...draft, ...row, group: "이벤트", requestId: key(20 + i) });
      if (res.status !== "SAVED") throw new Error(JSON.stringify(res));
      ids.push(res.id);
    }
    const catalog = () => m.getDonationCatalog().signatures.map((s) => s.id);
    expect(await m.setSignatureGroupActive({ group: "이벤트", active: false })).toEqual({ status: "SAVED", id: "이벤트" });
    expect(catalog()).not.toContain(ids[0]);
    expect(catalog()).not.toContain(ids[1]);
    expect(m.matchSignatureByAmount(3_000)).toBeNull();

    // While hidden, another signature took 4,000: showing the group again would put two on one amount.
    await m.saveSignature({ ...draft, name: "사천", price: 4_000, requestId: key(30) });
    const refused = await m.setSignatureGroupActive({ group: "이벤트", active: true });
    expect(refused.status === "INVALID" && refused.message).toBe("'이벤트2'(4,000 FN)와 '사천'(4,000 FN)의 금액 매칭이 겹쳐서 켤 수 없어요.");
    expect(catalog()).not.toContain(ids[0]); // nothing changed

    expect(await m.setSignatureGroupActive({ group: "없는 그룹", active: true })).toEqual({ status: "INVALID", message: "그룹을 찾을 수 없어요." });
    expect((await m.setSignatureGroupActive({ group: "이벤트", active: "yes" })).status).toBe("INVALID");
    expect((await m.setSignatureGroupActive({ group: "기본", active: false })).status).toBe("SAVED");
    signIn(["SUPPORTER"]);
    expect(await m.setSignatureGroupActive({ group: "이벤트", active: true })).toEqual({ status: "UNAUTHORIZED" });
  });
});
