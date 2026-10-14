import { describe, expect, it } from "vitest";
import { helperPathForStudio, isHelperHost, isHelperRequest, parseHostList, routeHelperRequest, routeSiteRequest } from "./helperRouting";

describe("isHelperHost", () => {
  it("uses HELPER_HOST when it is set (host and port, case-insensitive)", () => {
    const hosts = parseHostList(" Helper.Example.com , helper.localhost:3000 ");
    expect(hosts).toEqual(["helper.example.com", "helper.localhost:3000"]);
    expect(isHelperHost("HELPER.example.com", hosts)).toBe(true);
    expect(isHelperHost("helper.localhost:3000", hosts)).toBe(true);
    expect(isHelperHost("helper.localhost:3100", hosts)).toBe(false);
    expect(isHelperHost("example.com", hosts)).toBe(false);
  });

  it("treats any helper. host as the helper when HELPER_HOST is unset", () => {
    expect(isHelperHost("helper.localhost:3000", [])).toBe(true);
    expect(isHelperHost("localhost:3000", [])).toBe(false);
    expect(isHelperHost("myhelper.localhost", [])).toBe(false);
    expect(isHelperHost(null, [])).toBe(false);
  });
});

describe("isHelperRequest", () => {
  it("also reads the first X-Forwarded-Host (proxies, and Next's own server-action redirect render)", () => {
    expect(isHelperRequest("localhost:3300", "helper.localhost:3300", [])).toBe(true);
    expect(isHelperRequest("10.0.0.5:3000", "helper.example.com, proxy.internal", ["helper.example.com"])).toBe(true);
    expect(isHelperRequest("localhost:3300", "localhost:3300", [])).toBe(false);
    expect(isHelperRequest("example.com", null, ["helper.example.com"])).toBe(false);
  });
});

describe("routeHelperRequest", () => {
  it("rewrites helper pages to the /helper segment", () => {
    expect(routeHelperRequest("/", "")).toEqual({ action: "rewrite", path: "/helper" });
    expect(routeHelperRequest("/chat", "")).toEqual({ action: "rewrite", path: "/helper/chat" });
    expect(routeHelperRequest("/overlays/preview/alert", "?x=1")).toEqual({ action: "rewrite", path: "/helper/overlays/preview/alert?x=1" });
  });

  it("keeps site pages out of the helper (they land on the helper's 404)", () => {
    for (const p of ["/wallet", "/mypage", "/community", "/donation/youtube", "/creators"]) {
      expect(routeHelperRequest(p, "")).toEqual({ action: "rewrite", path: `/helper${p}` });
    }
    expect(routeHelperRequest("/api/admin/members", "")).toEqual({ action: "notFound" });
    expect(routeHelperRequest("/api/wallet/charges", "")).toEqual({ action: "notFound" });
    expect(routeHelperRequest("/api/bank-sms/abc", "")).toEqual({ action: "notFound" });
  });

  it("passes overlays, pop-outs, sign-in pages, terms and overlay media through", () => {
    for (const p of ["/overlay/alert/k", "/popout/chat", "/login", "/login/password-change", "/signup", "/password-reset", "/channel/new", "/terms/service", "/api/media/1", "/api/custom-sound/2", "/images/social/kakao.png", "/_next/data/x.json"]) {
      expect(routeHelperRequest(p, "")).toEqual({ action: "pass" });
    }
    // Segment-aware: not a prefix match on the name.
    expect(routeHelperRequest("/loginx", "")).toEqual({ action: "rewrite", path: "/helper/loginx" });
    expect(routeHelperRequest("/overlays", "")).toEqual({ action: "rewrite", path: "/helper/overlays" });
  });

  it("shows /helper/x as /x", () => {
    expect(routeHelperRequest("/helper", "")).toEqual({ action: "redirect", path: "/" });
    expect(routeHelperRequest("/helper/chat", "?a=1")).toEqual({ action: "redirect", path: "/chat?a=1" });
  });

  it("sends studio links to their helper page", () => {
    expect(routeHelperRequest("/creator/remote", "")).toEqual({ action: "redirect", path: "/remote" });
    expect(routeHelperRequest("/creator/widgets/tools", "")).toEqual({ action: "redirect", path: "/tools" });
  });
});

describe("helperPathForStudio", () => {
  it("maps the OBS studio screens and keeps the rest of the path and the query", () => {
    expect(helperPathForStudio("/creator/widgets/overlays/preview/alert", "")).toBe("/overlays/preview/alert");
    expect(helperPathForStudio("/creator/widgets/signatures", "?bulk=1")).toBe("/signatures?bulk=1");
    expect(helperPathForStudio("/creator/crew/broadcast", "")).toBe("/crew/broadcast");
    expect(helperPathForStudio("/creator/crew", "")).toBe("/crew");
    expect(helperPathForStudio("/creator/chat", "")).toBe("/chat");
    expect(helperPathForStudio("/creator/youtube", "")).toBe("/youtube");
    expect(helperPathForStudio("/creator/widgets", "")).toBe("/widgets");
  });

  it("maps 후원 필터링 only, without the tab", () => {
    expect(helperPathForStudio("/creator/donations", "?tab=filtering&sub=words")).toBe("/filtering?sub=words");
    expect(helperPathForStudio("/creator/donations", "?tab=filtering")).toBe("/filtering");
    expect(helperPathForStudio("/creator/donations", "?tab=list")).toBe("/");
  });

  it("sends studio pages the helper does not have to the helper home", () => {
    for (const p of ["/creator", "/creator/settlement", "/creator/revenue", "/creator/settings", "/creator/chatty"]) {
      expect(helperPathForStudio(p, "")).toBe("/");
    }
  });
});

describe("routeSiteRequest", () => {
  it("does not serve the helper pages on the site's host", () => {
    expect(routeSiteRequest("/wallet", "", [])).toEqual({ action: "pass" });
    expect(routeSiteRequest("/helperx", "", [])).toEqual({ action: "pass" });
    expect(routeSiteRequest("/helper/chat", "", [])).toEqual({ action: "notFound" });
    expect(routeSiteRequest("/helper", "?a=1", ["helper.example.com"])).toEqual({ action: "redirectHost", host: "helper.example.com", path: "/?a=1" });
  });
});
