import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { escapeXml, renderBannerSvg } from "./aiBannerCore";
import { AI_RATIOS, AI_STYLES, type AiBannerRequest } from "./aiBannerTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** AI 배너 (2026-10-24, StreamDonate "배너 제작" 참고) — P3, mock provider. */
const req = (patch: Partial<AiBannerRequest> = {}): AiBannerRequest => ({ prompt: "보라색 우주에 고양이, 게임 방송", headline: "오늘도 달린다", subline: "매일 밤 9시", style: "NEON", ratio: "WIDE", quality: "HIGH", seed: 7, ...patch });

describe("AI 배너 mock 그림", () => {
  it("draws the same banner for the same request and seed, and others for another seed or variant", () => {
    expect(renderBannerSvg(req(), 0)).toEqual(renderBannerSvg(req(), 0));
    expect(renderBannerSvg(req(), 0).svg).not.toBe(renderBannerSvg(req({ seed: 8 }), 0).svg);
    expect(renderBannerSvg(req(), 0).svg).not.toBe(renderBannerSvg(req(), 1).svg);
  });

  it("sizes by ratio × 화질 and draws every style as one plain SVG with the texts and the keyword motif", () => {
    for (const r of AI_RATIOS) {
      expect(renderBannerSvg(req({ ratio: r.key }), 0)).toMatchObject({ width: r.width, height: r.height });
      expect(renderBannerSvg(req({ ratio: r.key, quality: "STANDARD" }), 0)).toMatchObject({ width: Math.round(r.width * 0.6), height: Math.round(r.height * 0.6) });
    }
    for (const s of AI_STYLES) {
      const { svg } = renderBannerSvg(req({ style: s.key }), 2);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain("오늘도 달린다");
      expect(svg).toContain("매일 밤 9시");
      expect(svg).toContain("🐱"); // 고양이 in the description
      // Nothing that runs or fetches.
      for (const bad of ["<script", "href", "<image", "<foreignObject", "onload", "url(http"]) expect(svg).not.toContain(bad);
    }
    expect(renderBannerSvg(req({ prompt: "평범한 방송" , style: "SPACE" }), 0).svg).toContain("🪐");
  });

  it("escapes the texts", () => {
    expect(escapeXml(`<b>"A&B'</b>`)).toBe("&lt;b&gt;&quot;A&amp;B&#39;&lt;/b&gt;");
    const { svg } = renderBannerSvg(req({ headline: '<script>alert(1)</script>', subline: 'x" onload="y' }), 0);
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("x&quot; onload=&quot;y");
  });
});

describe("AI 배너", () => {
  beforeEach(() => resetMockStores());

  it("checks the request and returns four samples from the mock provider", async () => {
    const { generateBanners } = await import("./aiBanner");
    const res = await generateBanners(req());
    expect(res).toMatchObject({ status: "OK", provider: "MOCK" });
    if (res.status !== "OK") throw new Error("not ok");
    expect(res.images).toHaveLength(4);
    expect(new Set(res.images.map((i) => i.svg)).size).toBe(4);
    for (const [patch, message] of [
      [{ prompt: "", headline: "" }, "설명이나 배너 문구 중 하나는 넣어 주세요."],
      [{ prompt: "가".repeat(201) }, "설명은 200자까지 넣을 수 있어요."],
      [{ headline: "가".repeat(25) }, "배너 문구는 24자까지 넣을 수 있어요."],
      [{ subline: "가".repeat(41) }, "작은 문구는 40자까지 넣을 수 있어요."],
      [{ headline: "admin 방송" }, "사용할 수 없는 단어가 포함되어 있어요."],
      [{ style: "OIL" }, "설정을 확인해 주세요."],
      [{ ratio: "3:2" }, "설정을 확인해 주세요."],
      [{ seed: -1 }, "설정을 확인해 주세요."]
    ] as const) {
      expect(await generateBanners(req(patch as Partial<AiBannerRequest>))).toEqual({ status: "INVALID", message });
    }
    signIn(["SUPPORTER"]);
    expect(await generateBanners(req())).toEqual({ status: "UNAUTHORIZED" });
  });
});
