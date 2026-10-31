import { describe, expect, it } from "vitest";
import { mapFavoriteChange, mapFavoriteCheck, readChannelRow, readChannelRows } from "./channels";
import { FlextvUnavailableError } from "./client";

/** FLEXTV's channel lists and 즐겨찾기 (server/routes/api/channels, subscribes of FLEXTV's web repository), in its shapes. */

const owner = { loginId: "bj01", nickname: "방송인", thumbUrl: "https://cdn.flextv.test/a.png" };

describe("a channel row", () => {
  it("reads the ranking's, the search's and the 즐겨찾기 list's rows alike", () => {
    expect(readChannelRow({ id: 3021, name: "방송국", description: "소개", isInLive: true, stat: { numberOfSubs: 120 }, owner, playerCount: 33 })).toEqual({
      channelId: "3021",
      name: "방송인",
      ownerLoginId: "bj01",
      description: "소개",
      thumbUrl: "https://cdn.flextv.test/a.png",
      live: true,
      followers: 120,
      viewers: 33
    });
    // The 즐겨찾기 list: `numberOfSubs` beside the row; right after adding, `stat` is the count itself.
    expect(readChannelRow({ id: 3022, name: "방송국2", isInLive: 0, numberOfSubs: 7, owner })).toMatchObject({ followers: 7, live: false, viewers: 0 });
    expect(readChannelRow({ id: 3023, name: "방송국3", stat: 9, owner: null })).toMatchObject({ name: "방송국3", followers: 9, thumbUrl: null });
  });

  it("skips rows without an id and repeats", () => {
    expect(readChannelRows({ data: [{ id: 1, owner }, { id: "x" }, { id: 1, owner }, { id: 2, owner }] }).map((r) => r.channelId)).toEqual(["1", "2"]);
    expect(readChannelRows([{ id: 5, owner }])).toHaveLength(1);
    expect(readChannelRows("nope")).toEqual([]);
  });
});

describe("즐겨찾기", () => {
  it("reads FLEXTV's check", () => {
    expect(mapFavoriteCheck({ status: 200, data: { memberId: 1, channelId: 3021 } })).toBe(true);
    expect(mapFavoriteCheck({ status: 204, data: null })).toBe(false);
    expect(mapFavoriteCheck({ status: 401, data: null })).toBeNull();
    expect(() => mapFavoriteCheck({ status: 500, data: null })).toThrow(FlextvUnavailableError);
  });

  it("tells a done change from FLEXTV's unclear 'FAIL'", () => {
    expect(mapFavoriteChange({ status: 200, data: [{ id: 3021 }] })).toBe("DONE");
    expect(mapFavoriteChange({ status: 200, data: "OK" })).toBe("DONE");
    expect(mapFavoriteChange({ status: 200, data: "FAIL" })).toBe("UNCLEAR");
    expect(mapFavoriteChange({ status: 400, data: "본인인증 해주세요." })).toBe("UNCLEAR");
    expect(mapFavoriteChange({ status: 401, data: null })).toBe("UNAUTHORIZED");
    expect(() => mapFavoriteChange({ status: 502, data: null })).toThrow(FlextvUnavailableError);
  });
});
