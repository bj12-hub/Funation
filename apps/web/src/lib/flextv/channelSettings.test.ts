import { describe, expect, it } from "vitest";
import { mapChannelChange, mapNameCheck, readLinks } from "./channelSettings";
import { FlextvUnavailableError } from "./client";

/** FLEXTV's 채널 설정 answers (server/routes/api/my/channel.js of FLEXTV's web repository), in its shapes. */

describe("the channel's links", () => {
  it("reads the platforms and keeps the free links apart", () => {
    const links = readLinks({ instagram: "https://instagram.com/bj", title2: "카페", link2: "https://cafe.test/bj" });
    expect(links.platforms).toEqual({ instagram: "https://instagram.com/bj", youtube: "", discord: "", tiktok: "", twitter: "" });
    expect(links.extra).toMatchObject({ title1: "", link1: "", title2: "카페", link2: "https://cafe.test/bj" });
    // None saved yet: FLEXTV answers [].
    expect(readLinks([]).platforms.youtube).toBe("");
  });
});

describe("FLEXTV's answers", () => {
  it("reads the name check and a change", () => {
    expect(mapNameCheck({ status: 200, data: "ok" })).toBe("AVAILABLE");
    expect(mapNameCheck({ status: 200, data: "overlap" })).toBe("TAKEN");
    expect(mapNameCheck({ status: 401, data: null })).toBe("UNAUTHORIZED");
    expect(mapChannelChange({ status: 200, data: "OK" })).toBe("OK");
    expect(mapChannelChange({ status: 200, data: { instagram: "https://instagram.com/bj" } })).toBe("OK");
    expect(() => mapChannelChange({ status: 500, data: null })).toThrow(FlextvUnavailableError);
  });
});
