import { describe, expect, it } from "vitest";
import { studioActiveHref } from "./CreatorSideNav";

describe("studio sidebar active item", () => {
  it("matches 후원관리+ by tab and other pages by the most specific path", () => {
    expect(studioActiveHref("/creator", null)).toBe("/creator");
    expect(studioActiveHref("/creator/donations", null)).toBe("/creator/donations?tab=settings");
    expect(studioActiveHref("/creator/donations", "list")).toBe("/creator/donations?tab=list");
    expect(studioActiveHref("/creator/widgets", null)).toBe("/creator/widgets");
    expect(studioActiveHref("/creator/widgets/tools", null)).toBe("/creator/widgets/tools");
    expect(studioActiveHref("/creator/settlement/register/form", null)).toBe("/creator/settlement/register");
    expect(studioActiveHref("/creator/crew/broadcast", null)).toBe("/creator/crew/broadcast");
    expect(studioActiveHref("/creator/unknown", null)).toBeNull();
  });
});
