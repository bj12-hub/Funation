import { describe, expect, it } from "vitest";
import { activeHref } from "./SideNav";

describe("side menu active item", () => {
  it("picks the most specific menu entry for the current path", () => {
    expect(activeHref("/")).toBe("/");
    expect(activeHref("/wallet")).toBe("/wallet");
    expect(activeHref("/wallet/donations")).toBe("/wallet/donations");
    expect(activeHref("/wallet/charges")).toBe("/wallet");
    expect(activeHref("/mypage/titles")).toBe("/mypage/titles");
    expect(activeHref("/creators/c1")).toBe("/creators");
    expect(activeHref("/donation/soop/search")).toBe("/donation/soop");
    expect(activeHref("/live/popular")).toBe("/live");
    expect(activeHref("/terms/service")).toBeNull();
  });
});
