import { describe, expect, it } from "vitest";
import { readReceived, readReceivedSummary, receivedPath } from "./earnings";

/** FLEXTV's received-렉스 answers (server/services/luv of FLEXTV's web repository), in its shapes. */

describe("the received list", () => {
  it("reads one row per 후원, in KST, and tells which FLEXTV counts", () => {
    const { items, count } = readReceived({
      data: [
        { id: 51, amount: 100, memberId: "fan01", membernick: "팬1", targetId: 601900, productName: null, status: 9, createdAt: "2026-10-25T01:00:00.000Z" },
        { id: 52, amount: "300", memberId: "fan02", membernick: "", targetId: 601900, productName: "장미", status: 19, createdAt: "2026-10-24T12:00:00.000Z" },
        { id: null, amount: 5, createdAt: "2026-10-24T12:00:00.000Z" }
      ],
      count: 3
    });
    expect(count).toBe(3);
    expect(items).toEqual([
      { id: "51", at: "2026-10-25 10:00:00", rex: 100, donorNickname: "팬1", donorKey: "fan01", productName: null, counted: true },
      { id: "52", at: "2026-10-24 21:00:00", rex: 300, donorNickname: "알 수 없음", donorKey: "fan02", productName: "장미", counted: false }
    ]);
    expect(readReceived("Unauthorized")).toEqual({ items: [], count: 0 });
  });

  it("asks for whole days and at most FLEXTV's 50 rows", () => {
    const path = receivedPath({ offset: 100, limit: 500, from: "2026-10-01", to: "2026-10-25", nickname: "팬1" });
    const sp = new URL(path, "https://api.flextv.test").searchParams;
    expect(Object.fromEntries(sp)).toEqual({
      offset: "100",
      limit: "50",
      mobile: "false",
      sendLexOption: "ViewByCase",
      selectedStartDay: "2026-10-01 00:00:00",
      selectedEndDay: "2026-10-25 23:59:59",
      title: "팬1",
      searchOptions: "1"
    });
    expect(receivedPath({ offset: 0, limit: 6 })).not.toContain("selectedStartDay");
  });

  it("reads FLEXTV's summary, its empty sums as 0", () => {
    expect(readReceivedSummary({ todayamount: 100, exchangeamount: null, pendingdepositamount: 500, accumulateamount: 12000, received: 3000 })).toEqual({
      today: 100,
      accumulated: 12000,
      exchangeable: 3000,
      exchanging: 500,
      exchanged: 0
    });
    expect(readReceivedSummary("Unauthorized")).toBeNull();
  });
});
