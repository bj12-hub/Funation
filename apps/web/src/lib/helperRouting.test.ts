import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PUBLIC_FOLDERS, helperPathForStudio, isHelperHost, isHelperRequest, parseHostList, routeHelperRequest, routeSiteRequest } from "./helperRouting";

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

  it("does not let another spelling of the helper domain pass as the site (trailing dot, explicit port)", () => {
    const hosts = parseHostList("helper.example.com, helper.localhost:3000");
    // https://helper.example.com./wallet is the helper domain too: it must not be served the site's pages.
    expect(isHelperHost("helper.example.com.", hosts)).toBe(true);
    expect(isHelperHost("HELPER.example.com.:443", hosts)).toBe(true);
    // An entry without a port is that host on any port; an entry with one, that port only.
    expect(isHelperHost("helper.example.com:443", hosts)).toBe(true);
    expect(isHelperHost("helper.localhost.:3000", hosts)).toBe(true);
    expect(isHelperHost("helper.localhost:3100", hosts)).toBe(false);
    expect(isHelperHost("example.com.", hosts)).toBe(false);
    expect(isHelperHost("helper.localhost.:3000", [])).toBe(true);
    expect(parseHostList("Helper.Example.com.")).toEqual(["helper.example.com"]);
  });
});

describe("isHelperRequest", () => {
  it("also reads X-Forwarded-Host (proxies, and Next's own server-action redirect render)", () => {
    expect(isHelperRequest("localhost:3300", "helper.localhost:3300", [])).toBe(true);
    expect(isHelperRequest("10.0.0.5:3000", "helper.example.com, proxy.internal", ["helper.example.com"])).toBe(true);
    expect(isHelperRequest("localhost:3300", "localhost:3300", [])).toBe(false);
    expect(isHelperRequest("example.com", null, ["helper.example.com"])).toBe(false);
  });

  it("reads every X-Forwarded-Host value: a proxy that appends puts the client's own value first", () => {
    // The client on the helper domain sends `X-Forwarded-Host: example.com`; the proxy appends the real one.
    expect(isHelperRequest("10.0.0.5:3000", "example.com, helper.example.com", ["helper.example.com"])).toBe(true);
    expect(isHelperRequest("10.0.0.5:3000", "example.com,helper.example.com", ["helper.example.com"])).toBe(true);
    // Forging the header on the site only ever turns the request into a helper one (shows less).
    expect(isHelperRequest("example.com", "helper.example.com", ["helper.example.com"])).toBe(true);
    expect(isHelperRequest("example.com", "example.com, other.example.com", ["helper.example.com"])).toBe(false);
    expect(isHelperRequest(null, "", [])).toBe(false);
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
    expect(routeHelperRequest("/api/apiary", "")).toEqual({ action: "notFound" });
  });

  it("does not take an address with a dot in its last segment for a file", () => {
    // Dynamic segments accept dots: these would reach the admin API and the site's pages on the helper domain.
    for (const p of ["/api/admin/members/u.1", "/api/admin/settlements/s.json", "/api/wallet/donations.json", "/api/x.y"]) {
      expect(routeHelperRequest(p, "")).toEqual({ action: "notFound" });
    }
    for (const p of ["/donation/youtube/a.b", "/creators/hong.gd", "/wallet/charge.txt"]) {
      expect(routeHelperRequest(p, "")).toEqual({ action: "rewrite", path: `/helper${p}` });
    }
  });

  it("passes overlays, pop-outs, sign-in pages, terms and overlay media through", () => {
    for (const p of ["/overlay/alert/k", "/popout/chat", "/popout/remote", "/login", "/login/password-change", "/signup", "/password-reset", "/channel/new", "/terms/service", "/api/media/1", "/api/custom-sound/2", "/images/social/kakao.png", "/mock/sounds/a.mp3", "/_next/data/x.json"]) {
      expect(routeHelperRequest(p, "")).toEqual({ action: "pass" });
    }
    // Segment-aware: not a prefix match on the name.
    expect(routeHelperRequest("/loginx", "")).toEqual({ action: "rewrite", path: "/helper/loginx" });
    expect(routeHelperRequest("/overlays", "")).toEqual({ action: "rewrite", path: "/helper/overlays" });
    expect(routeHelperRequest("/imagesx/a.png", "")).toEqual({ action: "rewrite", path: "/helper/imagesx/a.png" });
  });

  it("serves the SMS 계좌후원 webhook whose address the helper's 후원 연동 page hands out", () => {
    // BankSmsCard shows `${location.origin}/api/bank-sms/<key>`: on the helper domain that address must reach the webhook.
    expect(routeHelperRequest(`/api/bank-sms/${crypto.randomUUID()}`, "")).toEqual({ action: "pass" });
    expect(routeHelperRequest("/api/bank-smsx/k", "")).toEqual({ action: "notFound" });
  });

  it("keeps the top-level public folders in sync with public/", () => {
    const entries = readdirSync(fileURLToPath(new URL("../../public", import.meta.url)), { withFileTypes: true });
    // A new folder needs adding to PUBLIC_FOLDERS (or the helper domain answers its files with the 404 page); files at
    // the top level of public/ are not served on the helper domain.
    expect(entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()).toEqual([...PUBLIC_FOLDERS].sort());
    expect(entries.filter((e) => !e.isDirectory()).map((e) => e.name)).toEqual([]);
  });

  it("shows /helper/x as /x", () => {
    expect(routeHelperRequest("/helper", "")).toEqual({ action: "redirect", path: "/" });
    expect(routeHelperRequest("/helper/", "")).toEqual({ action: "redirect", path: "/" });
    expect(routeHelperRequest("/helper/chat", "?a=1")).toEqual({ action: "redirect", path: "/chat?a=1" });
  });

  it("never redirects to another host", () => {
    // `//evil.com` and `/\evil.com` are another host to a browser (new URL("//evil.com", request.url)).
    for (const p of ["/helper//evil.com", "/helper/\\evil.com", "/helper/\\/evil.com", "/helper///evil.com/x"]) {
      const route = routeHelperRequest(p, "?a=1");
      expect(route.action).toBe("redirect");
      const path = (route as { path: string }).path;
      expect(new URL(path, "https://helper.example.com/").origin).toBe("https://helper.example.com");
      expect(path.startsWith("/evil.com")).toBe(true);
    }
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
    expect(helperPathForStudio("/creator/chat", "")).toBe("/chat/manage");
    expect(helperPathForStudio("/creator/youtube", "")).toBe("/youtube");
  });

  it("sends the 위젯 catalog to the widget's own page (`?open=`), or home", () => {
    expect(helperPathForStudio("/creator/widgets", "")).toBe("/");
    expect(helperPathForStudio("/creator/widgets", "?open=GOAL")).toBe("/goal");
    expect(helperPathForStudio("/creator/widgets", "?open=TOTAL")).toBe("/subtitles?tab=total");
    expect(helperPathForStudio("/creator/widgets", "?open=CUSTOM_SOUND")).toBe("/alert?tab=sound");
    expect(helperPathForStudio("/creator/widgets", "?open=toString")).toBe("/");
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

  it("sends /helper/x to the same path on the helper domain, never to another host", () => {
    const route = routeSiteRequest("/helper//evil.com", "", ["helper.example.com"]);
    expect(route).toEqual({ action: "redirectHost", host: "helper.example.com", path: "/evil.com" });
    expect(new URL((route as { path: string }).path, "https://helper.example.com").host).toBe("helper.example.com");
  });
});
