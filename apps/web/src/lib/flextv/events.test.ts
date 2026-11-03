import { describe, expect, it } from "vitest";
import { hallOfFameMonths, htmlToBlocks, readEventList, readEventPage, readHallOfFame } from "./events";

/** FLEXTV's 이벤트 and 명예의 전당 answers (server/routes/api/cs, api/events of its web repository), in its shapes. */

describe("이벤트", () => {
  it("reads the list, leaving FLEXTV's default picture out", () => {
    const list = readEventList({
      data: [
        { id: 51, title: "할로윈 이벤트", imgUrl: "https://static.flextv.test/e51.jpg", disclosure: false, startDate: "2026-10-20T00:00:00.000Z", endDate: "2026-10-31T14:59:59.000Z", createdAt: "2026-10-19T00:00:00.000Z", code: null },
        { id: 50, title: "명예의 전당", imgUrl: "/image/thumbnail.png", startDate: null, endDate: null, code: "halloffame" },
        { id: "x", title: "깨진 줄" },
        { id: 51, title: "할로윈 이벤트" }
      ],
      count: 9
    });
    expect(list.total).toBe(9);
    expect(list.items).toEqual([
      { id: "51", title: "할로윈 이벤트", imageUrl: "https://static.flextv.test/e51.jpg", startsAt: "2026-10-20T00:00:00.000Z", endsAt: "2026-10-31T14:59:59.000Z", code: null },
      { id: "50", title: "명예의 전당", imageUrl: null, startsAt: null, endsAt: null, code: "halloffame" }
    ]);
    expect(readEventList(null)).toEqual({ items: [], total: 0 });
  });

  it("shows an event's HTML as paragraphs and https pictures, in order, never as HTML", () => {
    expect(
      htmlToBlocks('<p>참여 방법</p><img src="https://static.flextv.test/a.jpg" alt="a"><p>기간: 10월&nbsp;31일까지</p><img src=\'http://plain.test/b.jpg\'><img src="javascript:alert(1)"><script>alert(1)</script><p onclick="x">끝</p>')
    ).toEqual([
      { kind: "text", text: "참여 방법" },
      { kind: "image", src: "https://static.flextv.test/a.jpg" },
      { kind: "text", text: "기간: 10월 31일까지" },
      { kind: "text", text: "끝" }
    ]);
    expect(htmlToBlocks("")).toEqual([]);
  });

  it("reads an event page with its neighbours", () => {
    const page = readEventPage({
      events: { id: 51, title: "할로윈 이벤트", bcontent: "<p>사탕을 모아요</p>", imgUrl: null, open: 1, startDate: "2026-10-20T00:00:00.000Z", endDate: null, code: "" },
      prevevents: { id: 49, title: "가을 이벤트", open: 1 },
      nextevents: null
    });
    expect(page).toMatchObject({ id: "51", ongoing: true, code: null, blocks: [{ kind: "text", text: "사탕을 모아요" }], prev: { id: "49", title: "가을 이벤트" }, next: null });
    expect(readEventPage({ events: { id: 52, open: 7, title: "지난 이벤트" } })).toMatchObject({ ongoing: false, blocks: [] });
    expect(readEventPage({})).toBeNull();
  });
});

describe("명예의 전당", () => {
  it("offers FLEXTV's months from January 2026, newest first", () => {
    expect(hallOfFameMonths("202603")).toEqual(["202603", "202602", "202601"]);
    expect(hallOfFameMonths("202701").slice(0, 2)).toEqual(["202701", "202612"]);
    expect(hallOfFameMonths("202512")).toEqual([]);
  });

  it("reads the month's supporters without their member numbers or 아이디", () => {
    const rows = readHallOfFame([
      { loginId: "fan01", nickname: "열혈팬", memberId: 700, channelId: 3050, point: 120000, rank: 1, badges: [{ id: 1, amount: 3 }, { id: 2, amount: 0 }, { id: 9, amount: 5 }] },
      { loginId: "fan02", nickname: "새싹", memberId: 701, channelId: null, point: "4500", rank: null, badges: [] },
      { loginId: "fan03", nickname: "" }
    ]);
    expect(rows).toEqual([
      { rank: 1, nickname: "열혈팬", channelId: "3050", points: 120000, badges: [{ id: 1, count: 3 }, { id: 2, count: 0 }] },
      { rank: 2, nickname: "새싹", channelId: null, points: 4500, badges: [] }
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/fan0|700/);
    expect(readHallOfFame(null)).toEqual([]);
  });
});
