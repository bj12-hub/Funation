import { describe, expect, it } from "vitest";
import { sameSecret } from "./secret";

describe("sameSecret", () => {
  it("matches only the exact string", () => {
    expect(sameSecret("abc-123", "abc-123")).toBe(true);
    expect(sameSecret("abc-124", "abc-123")).toBe(false);
    expect(sameSecret("abc-1234", "abc-123")).toBe(false);
    expect(sameSecret("", "abc-123")).toBe(false);
    expect(sameSecret(undefined, "abc-123")).toBe(false);
    expect(sameSecret(["abc-123"], "abc-123")).toBe(false);
    expect(sameSecret("", "")).toBe(false); // an unset secret never matches
  });
});
