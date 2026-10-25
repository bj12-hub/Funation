import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { mapChatChange, mapMemberChange, mapYoutubeLinkChange, readBanWords, readChannelMembers, readChatTexts, readYoutubeLink } from "./chatSettings";

/** FLEXTV's chat settings answers (server/routes/api/my/channel.js, api/channels/channel.js of its web repository), in its shapes. */

describe("채팅 공지 · 규칙", () => {
  it("reads them from the streamer's channel", () => {
    expect(readChatTexts({ id: 3021, broadcastNotice: "8시에 시작해요", broadcastRule: null })).toEqual({ notice: "8시에 시작해요", rule: "" });
    expect(readChatTexts(null)).toEqual({ notice: "", rule: "" });
  });

  it("reads a change", () => {
    expect(mapChatChange({ status: 200, data: "OK" })).toBe("OK");
    expect(mapChatChange({ status: 200, data: "ok" })).toBe("OK");
    expect(mapChatChange({ status: 403, data: "Forbidden" })).toBe("UNAUTHORIZED");
    expect(() => mapChatChange({ status: 400, data: "잘못된 접근입니다. 글자수 제한을 초과 했습니다." })).toThrow(FlextvUnavailableError);
  });
});

describe("금지어", () => {
  it("reads the channel's words, skipping empty and repeated rows", () => {
    expect(readBanWords([{ id: 5, channelId: 3021, text: "광고" }, { id: 6, text: " " }, { id: 5, text: "광고" }, { id: "x", text: "스팸" }, { id: 7, text: "도배" }])).toEqual([
      { id: "5", word: "광고" },
      { id: "7", word: "도배" }
    ]);
    expect(readBanWords(null)).toEqual([]);
  });
});

describe("매니저 · 블랙리스트", () => {
  it("reads the members with their 아이디", () => {
    const rows = [
      { id: 1, channelId: 3021, memberId: 601950, createdAt: "2026-10-20T03:00:00.000Z", member: { id: 601950, loginId: "helper01", nickname: "도우미", thumbUrl: null } },
      { id: 2, channelId: 3021, memberId: 601951, createdAt: "never", member: { id: 601951, loginId: "helper02", nickname: "" } },
      { id: 3, memberId: 601952, member: null },
      { id: 4, memberId: 601950, member: { loginId: "helper01" } }
    ];
    expect(readChannelMembers(rows)).toEqual([
      { memberId: "601950", loginId: "helper01", nickname: "도우미", since: "2026-10-20T03:00:00.000Z" },
      { memberId: "601951", loginId: "helper02", nickname: "helper02", since: "" }
    ]);
  });

  it("reads FLEXTV's reasons for not adding someone", () => {
    expect(mapMemberChange({ status: 200, data: "OK" })).toBe("OK");
    expect(mapMemberChange({ status: 400, data: "존재하지 않는 사용자 입니다." })).toBe("NO_MEMBER");
    expect(mapMemberChange({ status: 400, data: "본인을 등록할수는 없습니다." })).toBe("SELF");
    expect(mapMemberChange({ status: 400, data: "이미 매니저로 등록되었습니다." })).toBe("ALREADY");
    expect(mapMemberChange({ status: 400, data: "이미 블랙리스트로 등록되었습니다." })).toBe("ALREADY");
    expect(mapMemberChange({ status: 400, data: "Bad Request" })).toBe("REFUSED");
    expect(mapMemberChange({ status: 401, data: "Unauthorized" })).toBe("UNAUTHORIZED");
    expect(() => mapMemberChange({ status: 500, data: null })).toThrow(FlextvUnavailableError);
  });
});

describe("유튜브 채팅 연결", () => {
  it("reads the link and whether its chat is shown", () => {
    expect(readYoutubeLink({ kind: "handle", value: "@bj", raw: "https://youtube.com/@bj", notification: false, savedAt: 1793000000000 })).toEqual({
      kind: "handle",
      value: "@bj",
      raw: "https://youtube.com/@bj",
      showInChat: false,
      savedAt: new Date(1793000000000).toISOString()
    });
    // An older link without the toggle shows the chat.
    expect(readYoutubeLink({ kind: "videoId", value: "abcdefghijk" })).toMatchObject({ raw: "abcdefghijk", showInChat: true, savedAt: null });
    expect(readYoutubeLink({ kind: "playlist", value: "x" })).toBeNull();
    expect(readYoutubeLink(null)).toBeNull();
  });

  it("reads a change and FLEXTV's reason for refusing an address", () => {
    expect(mapYoutubeLinkChange({ status: 200, data: { kind: "handle", value: "@bj", raw: "@bj" } })).toEqual({ kind: "OK" });
    expect(mapYoutubeLinkChange({ status: 200, data: "OK" })).toEqual({ kind: "OK" });
    expect(mapYoutubeLinkChange({ status: 400, data: "유효한 유튜브 채널 주소가 아닙니다." })).toEqual({ kind: "INVALID", message: "유효한 유튜브 채널 주소가 아닙니다." });
    expect(mapYoutubeLinkChange({ status: 401, data: null })).toEqual({ kind: "UNAUTHORIZED" });
    expect(() => mapYoutubeLinkChange({ status: 200, data: "maybe" })).toThrow(FlextvUnavailableError);
  });
});
