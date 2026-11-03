import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { mapChatSend, mapWatch, readChat, readLiveList, readStreamDonors, readViewerCount } from "./live";

/** FLEXTV's live answers (server/routes/api/channels, channels/stream of FLEXTV's web repository), in its shapes. */

describe("the live list", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    channelId: 3021,
    title: "저녁 방송",
    thumbUrl: "https://thumb.flextv.test/3021.jpg",
    playerCount: 120,
    startedAt: "2026-10-25T10:00:00.000Z",
    themeId: 3,
    isInLive: true,
    barrier: { blind: false, suspended: false, isLocked: false, isForAdult: false },
    owner: { nickname: "방송인", loginId: "bj01", thumbUrl: "https://static.flextv.test/p.png" },
    ...over
  });

  it("reads what a card shows, and never the owner's 아이디", () => {
    const [live] = readLiveList({ data: [row()], count: 1 });
    expect(live).toEqual({
      channelId: "3021",
      title: "저녁 방송",
      thumbnailUrl: "https://thumb.flextv.test/3021.jpg",
      viewers: 120,
      startedAt: "2026-10-25T10:00:00.000Z",
      themeId: "3",
      ownerNickname: "방송인",
      ownerThumbUrl: "https://static.flextv.test/p.png"
    });
    expect(JSON.stringify(live)).not.toContain("bj01");
  });

  it("leaves out what is not on air, blinded or suspended", () => {
    const rows = [row({ channelId: 1 }), row({ channelId: 2, isInLive: false }), row({ channelId: 3, barrier: { blind: true } }), row({ channelId: 4, barrier: { suspended: true } }), { title: "no id" }];
    expect(readLiveList({ data: rows }).map((l) => l.channelId)).toEqual(["1"]);
    expect(readLiveList({ data: [row({ thumbUrl: "http://plain.test/t.jpg" })] })[0].thumbnailUrl).toBeNull();
  });
});

describe("watching in FLEXTV's player", () => {
  const stream = (barrier: Record<string, unknown> = {}) => ({
    status: 200,
    data: {
      stream: { id: 77, title: "저녁 방송", password: "secret", themeId: 5, createdAt: "2026-10-30T09:00:00.000Z" },
      status: { barrier, password: "secret", performance: { viewerCount: 42 }, startedAt: "2026-10-30T09:00:05.000Z" },
      sources: [{ url: "https://cdn.test/a.m3u8?token=t" }]
    }
  });

  it("plays a public stream in the embed, and keeps the room's settings to itself", () => {
    const watch = mapWatch(stream());
    expect(watch).toEqual({ kind: "EMBED", streamId: "77", title: "저녁 방송", viewers: 42, startedAt: "2026-10-30T09:00:05.000Z", themeId: "5", portrait: false });
    expect(JSON.stringify(watch)).not.toMatch(/secret|token|m3u8/);
  });

  it("tells a portrait stream from a landscape one by FLEXTV's 화면 방향", () => {
    const at = (displayMode: unknown) => mapWatch({ status: 200, data: { stream: { id: 77, title: "세로 방송", displayMode }, status: { barrier: {} } } });
    expect([at("portrait"), at("landscape"), at(undefined)].map((w) => w.kind === "EMBED" && w.portrait)).toEqual([true, false, false]);
  });

  it("sends a stream only some viewers may watch to FLEXTV", () => {
    expect(mapWatch(stream({ isForAdult: true }))).toEqual({ kind: "ON_FLEXTV", reason: "ADULT" });
    expect(mapWatch(stream({ isLocked: true }))).toEqual({ kind: "ON_FLEXTV", reason: "LOCKED" });
    expect(mapWatch(stream({ minRatingLevel: 3 }))).toEqual({ kind: "ON_FLEXTV", reason: "FAN_ONLY" });
    const refused = (message: string) => mapWatch({ status: 400, data: { message } });
    expect(refused("로그인후 이용이 가능합니다.")).toEqual({ kind: "ON_FLEXTV", reason: "ADULT" });
    expect(refused("풀방입니다.")).toEqual({ kind: "ON_FLEXTV", reason: "FULL" });
    expect(refused("팬등급 방입니다.")).toEqual({ kind: "ON_FLEXTV", reason: "FAN_ONLY" });
  });

  it("is offline once the stream ended, and unknown on FLEXTV's own failure", () => {
    expect(mapWatch({ status: 400, data: { message: "방송자가 방송을 종료 했습니다." } })).toEqual({ kind: "OFFLINE" });
    expect(() => mapWatch({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
  });
});

describe("viewers and the stream's top donors", () => {
  it("reads the viewer count, and none when nothing is on air", () => {
    expect(readViewerCount({ status: 200, data: { data: 128 } })).toBe(128);
    expect(readViewerCount({ status: 400, data: { message: "방송중이 아닙니다." } })).toBeNull();
    expect(() => readViewerCount({ status: 502, data: null })).toThrow(FlextvUnavailableError);
  });

  it("ranks the top three by rank, without member numbers or 아이디", () => {
    const row = (rank: number, nickname: string, amount: number) => ({ id: 900 + rank, loginId: `fan0${rank}`, channelId: 3021, rank, nickname, amount, thumbUrl: "https://static.flextv.test/a.png" });
    const donors = readStreamDonors({ data: [row(2, "둘째", 500), row(1, "첫째", 1000), row(3, "셋째", 100), row(4, "넷째", 50), { rank: 5, nickname: "", amount: 10 }], count: 4 });
    expect(donors.map((d) => [d.rank, d.nickname, d.amount])).toEqual([
      [1, "첫째", 1000],
      [2, "둘째", 500],
      [3, "셋째", 100]
    ]);
    expect(JSON.stringify(donors)).not.toMatch(/fan0|901/);
    expect(readStreamDonors({ data: [] })).toEqual([]);
  });
});

describe("chat", () => {
  it("reads lines with the sender's nickname and fan level only, emoticon lines as text", () => {
    const lines = readChat([
      { member: { id: 9, loginId: "viewer01", nickname: "시청자", level: 2, gender: "F" }, text: "안녕하세요", createdAt: "2026-10-25T10:00:01.000Z" },
      { member: { id: 9, nickname: "시청자" }, text: JSON.stringify([{ type: "text", msg: "와 " }, { type: "emoticon", url: "x" }]), createdAt: "2026-10-25T10:00:02.000Z" },
      { member: {}, text: "no sender", createdAt: "2026-10-25T10:00:03.000Z" }
    ]);
    expect(lines.map((l) => [l.memberId, l.nickname, l.fanLevel, l.text])).toEqual([
      ["9", "시청자", 2, "안녕하세요"],
      ["9", "시청자", 0, "와 (이모티콘)"]
    ]);
    expect(JSON.stringify(lines)).not.toMatch(/viewer01|gender/);
  });

  it("keys two lines of one member in one moment apart", () => {
    const at = "2026-10-25T10:00:01.000Z";
    const [a, b] = readChat([
      { member: { id: 9, nickname: "시청자" }, text: "ab", createdAt: at },
      { member: { id: 9, nickname: "시청자" }, text: "ba", createdAt: at }
    ]);
    expect(a.key).not.toBe(b.key);
  });

  it("maps FLEXTV's answers to a chat line", () => {
    expect(mapChatSend({ status: 200, data: "OK" })).toEqual({ kind: "SENT" });
    expect(mapChatSend({ status: 200, data: { error: 403, error_message: "empty" } })).toEqual({ kind: "INVALID" });
    expect(mapChatSend({ status: 401, data: "Unauthorized" })).toEqual({ kind: "UNAUTHORIZED" });
    expect(mapChatSend({ status: 400, data: { message: "잠시 동안 대화를 할 수 없습니다.", code: 403 } })).toEqual({ kind: "MUTED" });
    expect(mapChatSend({ status: 400, data: { message: "차단된 계정입니다.", code: 403 } })).toEqual({ kind: "BLOCKED" });
    expect(() => mapChatSend({ status: 502, data: null })).toThrow(FlextvUnavailableError);
  });
});
