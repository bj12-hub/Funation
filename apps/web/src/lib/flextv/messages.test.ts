import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { mapChange, mapSend, messageText, readBlocks, readMailbox } from "./messages";

/** FLEXTV's 쪽지 answers (server/routes/api/my, services/social of FLEXTV's web repository), in its shapes. */

const member = (id: number, loginId: string, nickname: string) => ({ id, loginId, nickname, thumbUrl: "https://cdn.flextv.test/p.png" });

describe("the mailbox", () => {
  it("reads both folders and their counts", () => {
    const box = readMailbox({
      recipientData: [{ id: 11, content: "안녕하세요", createdAt: "2026-10-25T01:00:00.000Z", hasRead: 0, sender: member(2, "bj01", "방송인"), target: member(1, "viewer01", "시청자"), isBlack: false }, { id: "x" }],
      sendData: [{ id: 12, content: "반가워요", createdAt: "2026-10-25T02:00:00.000Z", hasRead: 1, sender: member(1, "viewer01", "시청자"), target: member(2, "bj01", "방송인") }],
      recipientCount: 1,
      sendCount: 1
    });
    expect(box.received).toEqual([
      { id: "11", content: "안녕하세요", createdAt: "2026-10-25T01:00:00.000Z", read: false, sender: { memberId: "2", loginId: "bj01", nickname: "방송인", thumbUrl: "https://cdn.flextv.test/p.png" }, target: { memberId: "1", loginId: "viewer01", nickname: "시청자", thumbUrl: "https://cdn.flextv.test/p.png" }, blocked: false }
    ]);
    expect(box.sent[0]).toMatchObject({ id: "12", read: true, target: { loginId: "bj01" } });
    expect([box.receivedCount, box.sentCount]).toEqual([1, 1]);
    expect(readMailbox(null)).toEqual({ received: [], sent: [], receivedCount: 0, sentCount: 0 });
  });

  it("shows FLEXTV's own 쪽지 (URI-encoded JSON) by their title", () => {
    expect(messageText(encodeURIComponent(JSON.stringify({ title: "선물이 도착했어요", items: [] })))).toBe("선물이 도착했어요");
    expect(messageText("%7Bnot json")).toBe("%7Bnot json");
    expect(messageText("그냥 쪽지")).toBe("그냥 쪽지");
  });
});

describe("FLEXTV's answers", () => {
  it("reads a send", () => {
    expect(mapSend({ status: 200, data: "OK" })).toBe("SENT");
    expect(mapSend({ status: 200, data: "Black" })).toBe("BLOCKED");
    expect(mapSend({ status: 200, data: "stoped" })).toBe("SUSPENDED");
    expect(mapSend({ status: 200, data: "withdrawal" })).toBe("WITHDRAWN");
    expect(mapSend({ status: 200, data: "FAIL" })).toBe("REFUSED");
    expect(mapSend({ status: 401, data: null })).toBe("UNAUTHORIZED");
    expect(() => mapSend({ status: 200, data: "maybe" })).toThrow(FlextvUnavailableError);
  });

  it("reads a read, a delete and a block", () => {
    expect(mapChange({ status: 200, data: "OK" })).toBe("DONE");
    expect(mapChange({ status: 200, data: "ok" })).toBe("DONE");
    expect(mapChange({ status: 204, data: null })).toBe("NOT_FOUND");
    expect(mapChange({ status: 200, data: "fail" })).toBe("NOT_FOUND");
    expect(() => mapChange({ status: 500, data: null })).toThrow(FlextvUnavailableError);
  });

  it("reads the 쪽지 차단 list", () => {
    expect(readBlocks({ data: [{ id: 1, memberId: 1, targetId: 9, loginId: "spam01", nickname: "스팸", thumbUrl: null, createdAt: "2026-10-20T00:00:00.000Z" }, { targetId: null }], count: 1 })).toEqual({
      items: [{ memberId: "9", loginId: "spam01", nickname: "스팸", thumbUrl: null, blockedAt: "2026-10-20T00:00:00.000Z" }],
      total: 1
    });
  });
});
