import { describe, expect, it } from "vitest";
import nextConfig, { NOT_OVERLAY_SOURCE, PRIVATE_SOURCES } from "../../next.config";

/** Anchors a `headers()` source the way Next's path-to-regexp reads these: `/:path*` is zero or more segments. */
const matches = (source: string, path: string) => new RegExp(`^${source.replace(/\/:path\*/g, "(?:/.*)?")}$`).test(path);

describe("site response headers", () => {
  it("sends the baseline headers on every path and hides the framework", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const keys = Object.fromEntries(all.headers.map((h) => [h.key, h.value]));
    expect(keys["X-Content-Type-Options"]).toBe("nosniff");
    expect(keys["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(keys["Permissions-Policy"]).toContain("camera=()");
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("lets only this site frame its pages, but leaves the OBS overlays frameable", async () => {
    const rules = await nextConfig.headers!();
    const framing = rules.find((r) => r.headers.some((h) => h.key === "X-Frame-Options"))!;
    expect(framing.source).toBe(NOT_OVERLAY_SOURCE);
    expect(framing.headers.find((h) => h.key === "Content-Security-Policy")!.value).toContain("frame-ancestors 'self'");
    for (const path of ["/", "/wallet", "/creator/remote", "/creators/c1", "/overlays", "/overlayx", "/api/media/1"]) {
      expect(matches(framing.source, path), path).toBe(true);
    }
    for (const path of ["/overlay", "/overlay/alert/abcd", "/overlay/widget/goal/abcd"]) {
      expect(matches(framing.source, path), path).toBe(false);
    }
  });

  it("keeps the studio, overlays, account, wallet and API out of search engines", async () => {
    const rules = await nextConfig.headers!();
    const noindex = rules.filter((r) => r.headers.some((h) => h.key === "X-Robots-Tag")).map((r) => r.source);
    expect(noindex).toEqual(PRIVATE_SOURCES);
    for (const path of ["/creator/remote", "/overlay/alert/abcd", "/popout/remote", "/mypage", "/wallet/charges", "/api/bank-sms"]) {
      expect(noindex.some((s) => matches(s, path)), path).toBe(true);
    }
    for (const path of ["/", "/creators/c1", "/community", "/support", "/terms/service"]) {
      expect(noindex.some((s) => matches(s, path)), path).toBe(false);
    }
  });
});
