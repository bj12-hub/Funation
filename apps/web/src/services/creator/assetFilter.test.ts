import { describe, expect, it } from "vitest";
import { filterAssets, type Asset } from "./assetTypes";

/** 이미지·사운드 정렬 · 필터 (code-first, 2026-10-06). */
const file = (id: string, kind: Asset["kind"], name: string, size: number, uploadedAt: string): Asset => ({
  id,
  kind,
  name,
  mime: kind === "IMAGE" ? "image/png" : "audio/mpeg",
  size,
  url: `/api/media/${id}`,
  uploadedAt
});

// The store keeps the newest first; c and d were uploaded in the same millisecond (d last).
const library = [
  file("d", "IMAGE", "축하", 300, "2026-10-06T10:00:00.000Z"),
  file("c", "IMAGE", "Banner", 900, "2026-10-06T10:00:00.000Z"),
  file("s", "SOUND", "축하", 50, "2026-10-05T10:00:00.000Z"),
  file("b", "IMAGE", "가을 배경", 100, "2026-10-04T10:00:00.000Z"),
  file("a", "IMAGE", "banner 2", 500, "2026-10-01T10:00:00.000Z")
];
const ids = (f: Partial<Parameters<typeof filterAssets>[1]>) =>
  filterAssets(library, { kind: "IMAGE", query: "", sort: "NEW", pairedOnly: false, ...f }).map((a) => a.id);

describe("이미지·사운드 정렬 · 필터", () => {
  it("sorts one kind by time, name or size, keeping upload order on ties", () => {
    expect(ids({})).toEqual(["d", "c", "b", "a"]);
    expect(ids({ sort: "OLD" })).toEqual(["a", "b", "c", "d"]);
    expect(ids({ sort: "SIZE" })).toEqual(["c", "a", "d", "b"]);
    expect(ids({ sort: "NAME" })).toEqual(["b", "d", "c", "a"]); // 가나다 before ABC (ko collation)
    expect(ids({ kind: "SOUND" })).toEqual(["s"]);
  });

  it("finds names regardless of case and keeps only 짝 when asked", () => {
    expect(ids({ query: "  BANNER " })).toEqual(["c", "a"]);
    expect(ids({ query: "없는 이름" })).toEqual([]);
    expect(ids({ pairedOnly: true })).toEqual(["d"]);
    expect(ids({ kind: "SOUND", pairedOnly: true })).toEqual(["s"]);
  });
});
