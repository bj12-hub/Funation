import { describe, expect, it } from "vitest";
import { studioActiveHref, studioCurrentItem } from "./CreatorSideNav";

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
});
