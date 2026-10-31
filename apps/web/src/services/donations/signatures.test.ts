import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 후원 관리: the creator's list feeds the room panel and the Donation Core. */
async function load() {
  const sig = await import("./signatures");
  const core = await import("./signatureCore");
  const { requestDonation } = await import("./donate");
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.fnBalance = 100_000;
  return { ...sig, ...core, requestDonation };
}

const draft = { name: "새 시그", price: 12_345, imageUrl: "/mock/room/signatures/sig-3.png", match: "SELECT", active: true };

describe("signature management", () => {
  beforeEach(() => resetMockStores());

  it("creates once per request id and shows only active signatures in order", async () => {
    const m = await load();
    expect(m.getDonationCatalog().signatures).toHaveLength(8);
    const first = await m.saveSignature({ ...draft, requestId: key(1) });
    expect(await m.saveSignature({ ...draft, requestId: key(1) })).toEqual(first);
    expect((await m.listSignatures())!).toHaveLength(9);

    const zero = (await m.listSignatures())![0];
    await m.saveSignature({ ...zero, active: false });
    expect(m.getDonationCatalog().signatures.map((s) => s.id)).not.toContain(zero.id);
    if (first.status !== "SAVED") throw new Error("not saved");
    await m.moveSignature({ id: first.id, dir: "up" });
    expect((await m.listSignatures())!.at(-2)!.id).toBe(first.id);
    await m.deleteSignature(first.id);
    expect((await m.listSignatures())!).toHaveLength(8);
  });

  it("sorts the list by price or by when each was made, and deletes the picked ones at once (2026-10-28)", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-28T01:00:00Z"), toFake: ["Date"] });
    const m = await load();
    const { sortSignatures } = await import("./signatureTypes");
    const one = await m.saveSignature({ ...draft, name: "첫째", price: 30_001, requestId: key(60) });
    vi.setSystemTime(new Date("2026-10-28T01:01:00Z"));
    const two = await m.saveSignature({ ...draft, name: "둘째", price: 5_001, requestId: key(61) });
    await m.createSignatures({ requestId: key(62), match: "SELECT", active: true, rows: [{ ...draft, name: "셋째", price: 6_001 }] });
    if (one.status !== "SAVED" || two.status !== "SAVED") throw new Error("not saved");
    const list = (await m.listSignatures())!;
    expect(list.slice(-3).map((s) => s.createdAt)).toEqual(["2026-10-28T01:00:00.000Z", "2026-10-28T01:01:00.000Z", "2026-10-28T01:01:00.000Z"]);
    // Same time: the later in the list is the newer. Signatures from before (no createdAt) are the oldest, in list order.
    expect(sortSignatures(list, "NEWEST").slice(0, 3).map((s) => s.name)).toEqual(["셋째", "둘째", "첫째"]);
    expect(sortSignatures(list, "OLDEST").map((s) => s.id)).toEqual(list.map((s) => s.id));
    const asc = sortSignatures(list, "PRICE_ASC").map((s) => s.price);
    expect(asc).toEqual([...asc].sort((x, y) => x - y));
    expect(sortSignatures(list, "PRICE_DESC").map((s) => s.price)).toEqual([...asc].reverse());
    expect(sortSignatures(list, "ORDER")).toEqual(list);
    // Editing keeps when it was made.
    await m.saveSignature({ ...list.at(-3)!, price: 30_002 });
    expect((await m.listSignatures())!.at(-3)!.createdAt).toBe("2026-10-28T01:00:00.000Z");

    expect(await m.deleteSignatures({ ids: [one.id, two.id, "sig-gone"] })).toEqual({ status: "SAVED", id: "2" });
    expect((await m.listSignatures())!.map((s) => s.name)).not.toContain("첫째");
    expect((await m.listSignatures())!).toHaveLength(list.length - 2);
    expect(await m.deleteSignatures({ ids: [one.id] })).toEqual({ status: "SAVED", id: "0" }); // retried: nothing more
    for (const ids of [[], "x", [1], Array.from({ length: 1000 }, (_, i) => `s${i}`)]) {
      expect(await m.deleteSignatures({ ids })).toEqual({ status: "INVALID", message: "삭제할 시그니처를 골라 주세요." });
    }
    signIn(["SUPPORTER"]);
    expect(await m.deleteSignatures({ ids: [list[0].id] })).toEqual({ status: "UNAUTHORIZED" });
    vi.useRealTimers();
  });

  it("treats an NFD copy of a name as the same name", async () => {
    const m = await load();
    expect((await m.saveSignature({ ...draft, requestId: key(40) })).status).toBe("SAVED");
    expect(await m.saveSignature({ ...draft, name: draft.name.normalize("NFD"), price: 23_456, requestId: key(41) })).toEqual({ status: "INVALID", message: "같은 이름의 시그니처가 있어요." });
  });

  it("treats Object.prototype names as new request ids", async () => {
    const m = await load();
    const one = await m.saveSignature({ ...draft, requestId: "propertyIsEnumerable" });
    expect(one).toMatchObject({ status: "SAVED", id: expect.any(String) });
    const bulk = await m.createSignatures({ requestId: "propertyIsEnumerable", match: "SELECT", active: true, rows: [{ ...draft, name: "일괄 시그" }] });
    expect(bulk).toMatchObject({ status: "SAVED", ids: [expect.any(String)] });
    expect((await m.listSignatures())!).toHaveLength(10);
  });

  it("charges the managed price and matches a 일반 후원 amount to an AMOUNT signature", async () => {
    const m = await load();
    const zero = (await m.listSignatures())![0];
    await m.saveSignature({ ...zero, price: 20_000, match: "AMOUNT" });
    const base = { creatorId: "c1", hideProfile: false };
    // The panel sends the price it showed; a stale one is refused, the managed one is charged (never a client amount).
    const sign = (n: number, expectedAmount: number) => ({ ...base, type: "SIGNATURE", signatureId: zero.id, message: "", amount: 1, expectedAmount, idempotencyKey: key(n) });
    expect(await m.requestDonation(sign(1, zero.price))).toEqual({ status: "PRICE_CHANGED", amount: 20_000 });
    expect(await m.requestDonation(sign(2, 20_000))).toMatchObject({
      status: "COMPLETED",
      fnAmount: 20_000
    });
    // Room donations reach the studio alert queue only for the studio channel; the match itself:
    expect(m.matchSignatureByAmount(20_000)?.id).toBe(zero.id);
    expect(m.matchSignatureByAmount(20_001)).toBeNull();
  });

  it("creates one signature when the same request arrives twice at once", async () => {
    const m = await load();
    const before = (await m.listSignatures())!.length;
    const [a, b] = await Promise.all([m.saveSignature({ ...draft, requestId: key(9) }), m.saveSignature({ ...draft, requestId: key(9) })]);
    expect(a).toEqual(b);
    expect((await m.listSignatures())!).toHaveLength(before + 1);
  });

  it("validates input and requires the creator role", async () => {
    const m = await load();
    expect((await m.saveSignature({ ...draft, price: 99, requestId: key(4) })).status).toBe("INVALID");
    expect((await m.saveSignature({ ...draft, price: 1.5, requestId: key(4) })).status).toBe("INVALID");
    expect((await m.saveSignature({ ...draft, name: "", requestId: key(4) })).status).toBe("INVALID");
    expect((await m.saveSignature({ ...draft, imageUrl: "https://evil.example/x.png", requestId: key(4) })).status).toBe("INVALID");
    expect((await m.saveSignature({ ...draft, name: "제로투 Zero 2", requestId: key(4) })).status).toBe("INVALID");
    await m.saveSignature({ ...draft, match: "AMOUNT", requestId: key(5) });
    expect((await m.saveSignature({ ...draft, name: "다른 이름", match: "AMOUNT", requestId: key(6) })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.saveSignature({ ...draft, requestId: key(7) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.listSignatures()).toBeNull();
  });
});
