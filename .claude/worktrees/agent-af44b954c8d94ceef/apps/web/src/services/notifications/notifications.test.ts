import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 사이트 알림: services notify after their own change; retries never notify twice. */
async function load() {
  const n = await import("./notifications");
  const core = await import("./notificationCore");
  const { requestDonation } = await import("@/services/donations/donate");
  const { enqueueDonationAlert } = await import("@/services/creator/alertCore");
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.fnBalance = 100_000;
  return { ...n, ...core, requestDonation, enqueueDonationAlert, timeAgo: (await import("./notificationTypes")).timeAgo };
}

const text = (n: number) => ({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000, message: "", voiceId: null, idempotencyKey: key(n) });

describe("site notifications", () => {
  beforeEach(() => resetMockStores());

  it("notifies once per completed donation, including retries of the same request", async () => {
    const m = await load();
    const before = (await m.getUnreadCount())!;
    await m.requestDonation(text(1));
    await m.requestDonation(text(1));
    expect(await m.getUnreadCount()).toBe(before + 1);
    const page = (await m.listNotifications())!;
    expect(page.items[0]).toMatchObject({ kind: "DONATION_SENT", href: "/wallet/donations", read: false });
    expect(page.items[0].body).toContain("1,000 FN");

    // Insufficient FN: no donation, no notification.
    const { mockAccount } = await import("@/services/account/mockStore");
    mockAccount.fnBalance = 0;
    await m.requestDonation(text(2));
    expect(await m.getUnreadCount()).toBe(before + 1);
  });

  it("notifies the creator of donations to their channel", async () => {
    const m = await load();
    m.enqueueDonationAlert("c1", { donor: "A", message: "", fnAmount: 5_000, typeLabel: "후원" });
    const before = (await m.listNotifications())!.total;
    m.enqueueDonationAlert("studio", { donor: "A", message: "", fnAmount: 5_000, typeLabel: "후원" });
    const page = (await m.listNotifications())!;
    expect(page.total).toBe(before + 1);
    expect(page.items[0]).toMatchObject({ kind: "DONATION_RECEIVED", href: "/creator/donations?tab=list" });
  });

  it("filters, pages, marks read and needs a session", async () => {
    const m = await load();
    for (let i = 0; i < 25; i++) m.notify({ kind: "SYSTEM", title: `t${i}`, body: "", href: "/" });
    expect(m.notify({ kind: "SYSTEM", title: "x", body: "", href: "/", dedupeKey: "k" })).not.toBeNull();
    expect(m.notify({ kind: "SYSTEM", title: "x", body: "", href: "/", dedupeKey: "k" })).toBeNull();
    const first = (await m.listNotifications())!;
    expect(first).toMatchObject({ hasMore: true });
    expect(first.items).toHaveLength(20);
    await m.markNotificationRead(first.items[0].id);
    await m.markNotificationRead("nope");
    expect((await m.listNotifications({ filter: "UNREAD", show: 100 }))!.items.some((n) => n.id === first.items[0].id)).toBe(false);
    await m.markAllNotificationsRead();
    expect(await m.getUnreadCount()).toBe(0);
    expect(m.timeAgo(new Date(Date.now() - 90 * 60_000).toISOString())).toBe("1시간 전");
    signIn(null);
    expect(await m.getUnreadCount()).toBeNull();
    expect(await m.markAllNotificationsRead()).toEqual({ status: "UNAUTHORIZED" });
  });

  it("keeps ids unique once the inbox is full, so reading one marks only that one", async () => {
    const m = await load();
    for (let i = 0; i < 100; i++) m.notify({ kind: "SYSTEM", title: `t${i}`, body: "", href: "/" });
    // Two notifications in the same millisecond (e.g. two requests at once) on a full inbox.
    const now = Date.now();
    const a = m.notify({ kind: "SYSTEM", title: "a", body: "", href: "/" }, now)!;
    const b = m.notify({ kind: "SYSTEM", title: "b", body: "", href: "/" }, now)!;
    expect(a.id).not.toBe(b.id);
    await m.markNotificationRead(a.id);
    const unread = (await m.listNotifications({ filter: "UNREAD", show: 100 }))!.items.map((n) => n.title);
    expect(unread).toContain("b");
    expect(unread).not.toContain("a");
  });
});
