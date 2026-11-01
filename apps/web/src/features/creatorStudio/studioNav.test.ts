import { describe, expect, it } from "vitest";
import { flextvStudioServes } from "@/lib/flextv/studioRoutes";
import { studioActiveHref, studioCurrentItem, studioGroups } from "./CreatorSideNav";

describe("studio sidebar active item", () => {
  it("matches 후원관리+ by tab and other pages by the most specific path", () => {
    expect(studioActiveHref("/creator", null)).toBe("/creator");
    expect(studioActiveHref("/creator/donations", null)).toBe("/creator/donations?tab=settings");
    expect(studioActiveHref("/creator/donations", "list")).toBe("/creator/donations?tab=list");
    expect(studioActiveHref("/creator/donations", "import")).toBe("/creator/donations?tab=import");
    expect(studioActiveHref("/creator/widgets", null)).toBe("/creator/widgets");
    expect(studioActiveHref("/creator/widgets/tools", null)).toBe("/creator/widgets/tools");
    expect(studioActiveHref("/creator/widgets/play", null)).toBe("/creator/widgets/play");
    expect(studioActiveHref("/creator/widgets/play/rumble", null)).toBe("/creator/widgets/play");
    expect(studioActiveHref("/creator/widgets/play/live", null)).toBe("/creator/widgets/play");
    expect(studioActiveHref("/creator/widgets/onesource", null)).toBe("/creator/widgets/onesource");
    expect(studioActiveHref("/creator/widgets/custom", null)).toBe("/creator/widgets/custom");
    expect(studioActiveHref("/creator/chat/bot", null)).toBe("/creator/chat/bot");
    expect(studioActiveHref("/creator/widgets/music", null)).toBe("/creator/widgets/music");
    expect(studioActiveHref("/creator/widgets/bridge", null)).toBe("/creator/widgets/bridge");
    expect(studioActiveHref("/creator/chat", null)).toBe("/creator/chat");
    expect(studioActiveHref("/creator/settlement/register/form", null)).toBe("/creator/settlement/register");
    expect(studioActiveHref("/creator/crew/broadcast", null)).toBe("/creator/crew/broadcast");
    expect(studioActiveHref("/creator/unknown", null)).toBeNull();
  });

  it("names the current page on the phone menu bar", () => {
    expect(studioCurrentItem(studioActiveHref("/creator", null))).toEqual({ label: "대시보드", emoji: "📊", inMenu: true });
    expect(studioCurrentItem(studioActiveHref("/creator/remote", null))).toMatchObject({ label: "리모컨", emoji: "🎛️" });
    expect(studioCurrentItem(studioActiveHref("/creator/widgets/banner", null))).toMatchObject({ label: "위젯" });
    expect(studioCurrentItem(studioActiveHref("/creator/donations", "filtering"))).toMatchObject({ label: "후원 필터링" });
    // A page outside the menu shows the studio's name (and is not announced as a menu item).
    expect(studioCurrentItem(studioActiveHref("/creator/unknown", null))).toEqual({ label: "크리에이터 스튜디오", emoji: null, inMenu: false });
  });

  it("offers only the pages connected to FLEXTV with its backend (phase 5)", () => {
    const flextv = studioGroups(true);
    const hrefs = flextv.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(["/creator", "/creator/broadcast", "/creator/revenue", "/creator/donations?tab=list", "/creator/settlement", "/creator/settlement/register", "/creator/settlement/apply", "/creator/settlement/manage"]);
    // Every one is a page the middleware serves with FLEXTV.
    for (const href of hrefs) expect(flextvStudioServes(href!.split("?")[0])).toBe(true);
    expect(studioActiveHref("/creator/donations", null, flextv)).toBe("/creator/donations?tab=list");
    expect(studioCurrentItem(studioActiveHref("/creator/broadcast", null, flextv), flextv)).toMatchObject({ label: "방송 설정" });
    // The mock studio has no 방송 설정.
    expect(studioActiveHref("/creator/broadcast", null)).toBeNull();
    // 후원 종류 설정 only with FLEXTV's Ssumnation endpoints (phase 6).
    expect(hrefs).not.toContain("/creator/donation-types");
    const withTypes = studioGroups(true, true);
    expect(studioActiveHref("/creator/donation-types", null, withTypes)).toBe("/creator/donation-types");
    expect(flextvStudioServes("/creator/donation-types")).toBe(true);
  });
});
