import { describe, expect, it } from "vitest";
import { ownEntry } from "./records";

describe("ownEntry", () => {
  it("finds own entries only, never Object.prototype members", () => {
    const map: Record<string, number> = { a: 1 };
    expect(ownEntry(map, "a")).toBe(1);
    expect(ownEntry(map, "b")).toBeUndefined();
    for (const k of ["__proto__", "propertyIsEnumerable", "constructor", "toString", "hasOwnProperty"]) expect(ownEntry(map, k)).toBeUndefined();
  });
});
