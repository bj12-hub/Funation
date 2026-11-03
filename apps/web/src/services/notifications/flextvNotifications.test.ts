import { describe, expect, it, vi } from "vitest";
import { readNotifications } from "@/lib/flextv/notifications";

/** Phase 7: FLEXTV's 알림 on Ssumnation's bell and page. */

vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_WEB_URL: "https://www.flextv.test" }));

const { siteNotificationOf } = await import("./flextvNotifications");

describe("FLEXTV's 알림", () => {
  it("reads FLEXTV's list and only its own addresses", () => {
    const list = readNotifications({
      result: true,
      data: [
        { typeLabel: "즐겨찾기 호스트 방송 시작", message: "방송인 님이 방송을 시작하였습니다.", metadata: { thumbUrl: "https://cdn.flextv.test/a.png" } },
        { typeLabel: "신규 업적 달성", message: "업적을 달성했어요", metadata: { redirect: "/channels/3021/profile" } },
        { typeLabel: "퀘스트 완료", message: "퀘스트 완료", metadata: { redirect: "/honey-pot" } },
        { typeLabel: "꿀", message: "외부", metadata: { redirect: "//evil.test/x" } },
        { typeLabel: "x" }
      ]
    });
    expect(list.map((n) => n.redirect)).toEqual([null, "/channels/3021/profile", "/honey-pot", null]);
  });

  it("links a channel to its room, FLEXTV's other pages to its site, and the rest here", () => {
    const [live, achievement, quest, other] = readNotifications({
      data: [
        { typeLabel: "즐겨찾기 호스트 방송 시작", message: "방송 시작", metadata: {} },
        { typeLabel: "신규 업적 달성", message: "업적", metadata: { redirect: "/channels/3021/profile" } },
        { typeLabel: "퀘스트 완료", message: "퀘스트", metadata: { redirect: "/honey-pot" } },
        { typeLabel: "충전 완료", message: "충전", metadata: {} }
      ]
    }).map(siteNotificationOf);
    expect(live).toMatchObject({ kind: "LIVE", href: "/favorites", createdAt: null, read: true });
    expect(achievement).toMatchObject({ kind: "SYSTEM", title: "신규 업적 달성", href: "/creators/3021" });
    expect(quest.href).toBe("https://www.flextv.test/honey-pot");
    expect(other).toMatchObject({ kind: "CHARGE", href: "/wallet/charges" });
  });
});
