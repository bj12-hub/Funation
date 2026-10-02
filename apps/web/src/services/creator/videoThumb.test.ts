import { describe, expect, it } from "vitest";
import { videoThumbUrl } from "./videoThumb";

describe("videoThumbUrl", () => {
  it("uses a local illustration in mock mode, stable per video id", () => {
    const a = videoThumbUrl("aaaaaaaaaaa");
    expect(a).toMatch(/^\/mock\/video\/thumb-[1-6]\.jpg$/);
    expect(videoThumbUrl("aaaaaaaaaaa", "default")).toBe(a);
    expect(new Set(["a1", "b2", "c3", "d4", "e5", "f6", "g7"].map((id) => videoThumbUrl(id))).size).toBeGreaterThan(1);
  });
});
