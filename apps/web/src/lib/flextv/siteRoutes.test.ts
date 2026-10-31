import { describe, expect, it } from "vitest";
import { siteGroups } from "@/components/layout/SideNav/SideNav";
import { flextvServesLink, flextvSiteRoute } from "./siteRoutes";

describe("the site with FLEXTV (phase 7)", () => {
  it("serves the pages that run on FLEXTV", () => {
    for (const path of ["/", "/live", "/creators", "/creators/3021", "/favorites", "/mypage", "/notifications", "/support", "/support/notices/3", "/wallet", "/wallet/donations", "/login", "/signup", "/channel/new", "/creator", "/terms/service"]) {
      expect(flextvSiteRoute(path)).toBe("serve");
    }
  });

  it("sends the pages FLEXTV has no backend for home", () => {
    for (const path of ["/community", "/community/12/edit", "/events/3", "/attendance", "/hall-of-fame", "/donation/soop", "/donation/history", "/play/marble/x", "/messages", "/mypage/titles", "/mypage/nicknames/", "/mypage/ranking", "/mypage/blocks", "/mypage/withdraw", "/password-reset", "/login/password-change"]) {
      expect(flextvSiteRoute(path)).toBe("home");
    }
    // Segment-aware: a page whose name only starts the same is not caught.
    expect(flextvSiteRoute("/eventsx")).toBe("serve");
    expect(flextvSiteRoute("/donations")).toBe("serve");
  });

  it("answers the mock studio's overlays, pop-outs and API routes with a 404", () => {
    for (const path of ["/overlay/alert/k", "/overlay/chat/k", "/overlay/tool/timer/k", "/overlay", "/popout/chat", "/popout/chat/m/t", "/api/media/1", "/api/custom-sound/1", "/api/play/rumble-live/input", "/api/bank-sms/k"]) {
      expect(flextvSiteRoute(path)).toBe("notFound");
    }
    expect(flextvSiteRoute("/overlay/widget/quest/k")).toBe("serve");
    expect(flextvSiteRoute("/popout/remote")).toBe("serve");
    expect(flextvSiteRoute("/api/wallet/charges")).toBe("serve");
  });

  it("leaves those pages out of the side menu, and the groups left empty", () => {
    const hrefs = (flextv: boolean) => siteGroups(flextv).flatMap((g) => g.items.map((i) => i.href ?? ""));
    expect(hrefs(false)).toContain("/community");
    expect(hrefs(true)).not.toContain("/community");
    for (const href of hrefs(true).filter(Boolean)) expect(flextvServesLink(href)).toBe(true);
    // 후원 (SOOP · FlexTV · 후원 내역) is gone as a whole.
    expect(siteGroups(true).some((g) => g.title === "side.groupDonate")).toBe(false);
    expect(hrefs(true)).toEqual(expect.arrayContaining(["/", "/live", "/creators", "/favorites", "/mypage", "/wallet/donations", "/wallet", "/support"]));
  });
});
