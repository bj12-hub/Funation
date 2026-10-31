import { describe, expect, it } from "vitest";
import { readFans, readNews } from "./room";

/** A FLEXTV channel's 소식 and 팬 랭킹 (server/routes/api/channels/channel.js of FLEXTV's web repository), in its shapes. */

const post = (over: Record<string, unknown> = {}) => ({
  id: 41,
  channelId: 3021,
  title: "오늘 저녁 8시 방송",
  content: "같이 봐요",
  imageUrl: "https://cdn.flextv.test/talk/41.jpg?type=f&w=320",
  imageUrls: ["https://cdn.flextv.test/talk/41.jpg"],
  important: 1,
  createdAt: "2026-10-24T11:00:00.000Z",
  viewCount: 52,
  adult: 0,
  parent: 0,
  background_color: "#fff",
  ...over
});

describe("소식", () => {
  it("reads what FLEXTV's channel page lists, in its order", () => {
    expect(readNews({ data: [post(), post({ id: 42, important: 0, adult: 1, imageUrl: null, viewCount: "7" })] })).toEqual([
      { id: "41", title: "오늘 저녁 8시 방송", imageUrl: "https://cdn.flextv.test/talk/41.jpg?type=f&w=320", important: true, adult: false, createdAt: "2026-10-24T11:00:00.000Z", views: 52 },
      { id: "42", title: "오늘 저녁 8시 방송", imageUrl: null, important: false, adult: true, createdAt: "2026-10-24T11:00:00.000Z", views: 7 }
    ]);
  });

  it("leaves out comments, repeats, broken rows and pictures that are not https", () => {
    const items = readNews({ data: [post({ parent: 40 }), post(), post(), post({ id: "x" }), post({ id: 43, createdAt: "never" }), post({ id: 44, imageUrl: "javascript:alert(1)" }), "nope"] });
    expect(items.map((n) => n.id)).toEqual(["41", "44"]);
    expect(items[1].imageUrl).toBeNull();
    expect(readNews(null)).toEqual([]);
    expect(readNews({ data: "nope" })).toEqual([]);
  });
});

describe("팬 랭킹", () => {
  const fan = (loginId: string, nickname: string, name: string) => ({ channelId: 3021, level: 3, name, createdAt: "2026-10-01T00:00:00.000Z", member: { id: 9, nickname, loginId, thumbUrl: null } });

  it("reads the fans in FLEXTV's order with their 팬 등급, and nothing else", () => {
    expect(readFans({ data: [fan("fan01", "열혈팬", "VIP"), fan("fan02", "새싹", "")], count: 2 })).toEqual([
      { loginId: "fan01", nickname: "열혈팬", levelName: "VIP" },
      { loginId: "fan02", nickname: "새싹", levelName: "" }
    ]);
  });

  it("skips rows without a member and repeats", () => {
    expect(readFans({ data: [fan("fan01", "열혈팬", "VIP"), { level: 1, name: "팬" }, fan("fan01", "열혈팬", "VIP"), fan("", "익명", "팬")] })).toHaveLength(1);
    expect(readFans(null)).toEqual([]);
  });
});
