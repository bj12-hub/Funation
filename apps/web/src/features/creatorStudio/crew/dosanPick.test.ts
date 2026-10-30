import { describe, expect, it } from "vitest";
import { paintPick, pickDosanSignatures, sortDosanSignatures } from "./dosanPick";

const sig = (id: string, price: number, active = true) => ({ id, price, active });
const list = [sig("a", 5_000), sig("b", 12_000), sig("c", 30_000), sig("d", 15_000, false), sig("e", 20_000), sig("f", 9_000)];

describe("시그니처 두산 랜덤 선택 (2026-10-28)", () => {
  it("picks up to the count among the signatures in use within the range", () => {
    let n = 0;
    const steps = [0.9, 0.1, 0.5, 0.3, 0.7];
    const random = () => steps[n++ % steps.length];
    const res = pickDosanSignatures(list, { min: 9_000, max: 20_000, count: 2 }, random);
    expect(res.found).toBe(3); // b, e, f — d is hidden, a and c are out of range
    expect(res.ids).toHaveLength(2);
    for (const id of res.ids) expect(["b", "e", "f"]).toContain(id);
    expect(new Set(res.ids).size).toBe(2);
  });

  it("takes every one when fewer than the count, and none outside the range", () => {
    expect(pickDosanSignatures(list, { min: null, max: 9_000, count: 5 }).ids.sort()).toEqual(["a", "f"]);
    expect(pickDosanSignatures(list, { min: 40_000, max: null, count: 5 })).toEqual({ ids: [], found: 0 });
    expect(pickDosanSignatures(list, { min: null, max: null, count: 0 }).ids).toEqual([]);
  });

  it("sorts the list by price either way, or keeps the list order", () => {
    expect(sortDosanSignatures(list, "PRICE_ASC").map((s) => s.id)).toEqual(["a", "f", "b", "d", "e", "c"]);
    expect(sortDosanSignatures(list, "PRICE_DESC").map((s) => s.id)).toEqual(["c", "e", "d", "b", "f", "a"]);
    expect(sortDosanSignatures(list, "LIST").map((s) => s.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("두산 시그니처 고르기 (2026-10-30)", () => {
  it("sorts by when each was made — older ones without it as the oldest, in list order", () => {
    const made = [
      { id: "old1", price: 1 },
      { id: "new1", price: 2, createdAt: "2026-10-29T01:00:00.000Z" },
      { id: "old2", price: 3 },
      { id: "new2", price: 4, createdAt: "2026-10-30T01:00:00.000Z" }
    ];
    expect(sortDosanSignatures(made, "NEWEST").map((s) => s.id)).toEqual(["new2", "new1", "old2", "old1"]);
    expect(sortDosanSignatures(made, "OLDEST").map((s) => s.id)).toEqual(["old1", "old2", "new1", "new2"]);
  });

  it("puts a dragged-over chip in or out, never past the most", () => {
    expect(paintPick(["a"], "b", true, 3)).toEqual(["a", "b"]);
    expect(paintPick(["a", "b"], "b", true, 3)).toEqual(["a", "b"]);
    expect(paintPick(["a", "b", "c"], "d", true, 3)).toEqual(["a", "b", "c"]);
    expect(paintPick(["a", "b"], "a", false, 3)).toEqual(["b"]);
    expect(paintPick(["a"], "z", false, 3)).toEqual(["a"]);
  });
});
