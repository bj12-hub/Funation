import { describe, expect, it } from "vitest";
import nextConfig, { MUSIC_EDITOR_PERMISSIONS, MUSIC_EDITOR_SOURCE, NOT_OVERLAY_SOURCE, PRIVATE_SOURCES, SANDBOX_CSP } from "../../next.config";

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

  it("sandboxes the 커스텀 오버레이 page by its own header: scripts only, no network", async () => {
    const rules = await nextConfig.headers!();
    const sandbox = rules.find((r) => r.source === "/sandbox/:path*")!;
    const csp = sandbox.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toBe(SANDBOX_CSP);
    expect(csp.startsWith("sandbox allow-scripts;")).toBe(true);
    expect(csp).not.toContain("allow-same-origin");
    for (const directive of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "frame-src 'none'", "worker-src 'none'", "base-uri 'none'", "frame-ancestors 'self'"]) expect(csp).toContain(directive);
    expect(matches(sandbox.source, "/sandbox/custom-overlay.html")).toBe(true);
    // Only this site may frame it, like every page outside /overlay (its own CSP replaces the site-wide one there).
    expect(matches(NOT_OVERLAY_SOURCE, "/sandbox/custom-overlay.html")).toBe(true);
    // The page hosting the sandbox has the overlay key in its address: no referrer leaves it (the later rule wins).
    const custom = [...rules].reverse().find((r) => matches(r.source, "/overlay/custom/abcd") && r.headers.some((h) => h.key === "Referrer-Policy"))!;
    expect(custom.headers.find((h) => h.key === "Referrer-Policy")!.value).toBe("no-referrer");
    expect(rules.indexOf(custom)).toBeGreaterThan(rules.findIndex((r) => r.source === "/:path*"));
  });

  it("allows the microphone on the 음악 편집기 page only, for this site only", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    expect(all.headers.find((h) => h.key === "Permissions-Policy")!.value).toContain("microphone=()");
    const music = rules.find((r) => r.source === MUSIC_EDITOR_SOURCE)!;
    expect(music.headers).toEqual([{ key: "Permissions-Policy", value: MUSIC_EDITOR_PERMISSIONS }]);
    expect(MUSIC_EDITOR_PERMISSIONS).toBe("camera=(), microphone=(self), geolocation=()");
    // The later rule wins: it comes after the site-wide one. Only that exact page matches.
    expect(rules.indexOf(music)).toBeGreaterThan(rules.indexOf(all));
    for (const path of ["/creator/widgets/music/x", "/creator/widgets/musicx", "/creator/widgets"]) expect(matches(MUSIC_EDITOR_SOURCE, path), path).toBe(false);
  });

  it("keeps the studio, overlays, account, wallet and API out of search engines", async () => {
    const rules = await nextConfig.headers!();
    const noindex = rules.filter((r) => r.headers.some((h) => h.key === "X-Robots-Tag")).map((r) => r.source);
    expect(noindex).toEqual(PRIVATE_SOURCES);
    for (const path of ["/creator/remote", "/overlay/alert/abcd", "/sandbox/custom-overlay.html", "/popout/remote", "/mypage", "/wallet/charges", "/api/bank-sms"]) {
      expect(noindex.some((s) => matches(s, path)), path).toBe(true);
    }
    for (const path of ["/", "/creators/c1", "/community", "/support", "/terms/service"]) {
      expect(noindex.some((s) => matches(s, path)), path).toBe(false);
    }
  });
});
