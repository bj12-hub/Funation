import { describe, expect, it } from "vitest";
import { CHANNEL_VIEWS, parseChannelView } from "./channelView";

describe("creator channel tabs", () => {
  it("follows the funnation channel order and falls back to 홈", () => {
    expect(CHANNEL_VIEWS.map((v) => v.label)).toEqual(["홈", "크루", "영상", "커뮤니티", "시그니처", "소개"]);
    expect(parseChannelView("signatures")).toBe("signatures");
    expect(parseChannelView("nope")).toBe("home");
    expect(parseChannelView(undefined)).toBe("home");
  });
});
