import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 쪽지 (code-first): mailbox moves, soft delete, send validation and the send limit. */
async function load() {
  return import("./messages");
}

describe("쪽지", () => {
  beforeEach(() => resetMockStores());

  it("sends to a creator and shows it in 보낸 쪽지", async () => {
    const { sendMessage, getMailbox } = await load();
    expect(await sendMessage({ to: "c4", body: "다음 방송 기대해요" })).toEqual({ status: "SAVED" });
    const sent = (await getMailbox({ box: "sent" }))!;
    expect(sent.items[0]).toMatchObject({ peerId: "c4", body: "다음 방송 기대해요", direction: "OUT" });
  });

  it("validates recipient and body", async () => {
    const { sendMessage } = await load();
    expect((await sendMessage({ to: "nobody", body: "안녕" })).status).toBe("INVALID");
    expect((await sendMessage({ to: "c4", body: "  " })).status).toBe("INVALID");
    expect((await sendMessage({ to: "c4", body: "가".repeat(501) })).status).toBe("INVALID");
    expect((await sendMessage({ to: "c4", body: "admin 입니다" })).status).toBe("INVALID");
  });

  it("pages by the chosen size (15 · 30 · 50), falling back to 15", async () => {
    const { getMailbox } = await load();
    const { mockMessages } = await import("./mockMessageStore");
    for (let i = 0; i < 40; i++) {
      mockMessages.messages.push({ id: `ms-x${i}`, direction: "IN", peerId: "c1", peerName: "하루봄", body: `공지 ${i}`, sentAt: new Date(2026, 0, 1, 0, i).toISOString(), read: true, folder: "inbox", deleted: false });
    }
    const def = (await getMailbox({ box: "inbox" }))!;
    expect(def).toMatchObject({ size: 15, total: 42, totalPages: 3 });
    expect(def.items).toHaveLength(15);
    const thirty = (await getMailbox({ box: "inbox", size: "30", page: "2" }))!;
    expect(thirty).toMatchObject({ size: 30, totalPages: 2, page: 2 });
    expect(thirty.items).toHaveLength(12);
    expect((await getMailbox({ box: "inbox", size: "50" }))!.items).toHaveLength(42);
    for (const bad of ["20", "-1", "abc", undefined]) expect((await getMailbox({ box: "inbox", size: bad }))!.size).toBe(15);
  });

  it("limits sends per hour (placeholder anti-spam)", async () => {
    const { sendMessage } = await load();
    for (let i = 0; i < 20; i++) expect((await sendMessage({ to: "c1", body: `메시지 ${i}` })).status).toBe("SAVED");
    expect((await sendMessage({ to: "c1", body: "21번째" })).status).toBe("LIMITED");
  });

  it("moves received mail, keeps sent mail in place, and soft-deletes idempotently", async () => {
    const { getMailbox, moveMessages, deleteMessages, markMessageRead } = await load();
    let inbox = (await getMailbox({ box: "inbox" }))!;
    expect(inbox.unread).toBe(1);
    const unread = inbox.items.find((m) => !m.read)!;
    await markMessageRead(unread.id);
    expect((await getMailbox({ box: "inbox" }))!.unread).toBe(0);

    await moveMessages({ ids: [unread.id, "ms-3"], to: "spam" });
    expect((await getMailbox({ box: "spam" }))!.items.map((m) => m.id)).toEqual([unread.id]);
    expect((await getMailbox({ box: "sent" }))!.items.some((m) => m.id === "ms-3")).toBe(true);

    expect(await deleteMessages([unread.id])).toEqual({ status: "SAVED" });
    expect(await deleteMessages([unread.id])).toEqual({ status: "SAVED" });
    expect((await getMailbox({ box: "spam" }))!.items).toHaveLength(0);
    expect((await moveMessages({ ids: [], to: "inbox" })).status).toBe("INVALID");
    inbox = (await getMailbox({ box: "inbox" }))!;
    expect(inbox.counts.spam).toBe(0);
  });

  it("says a search found nothing, and names an empty box with the right particle", async () => {
    const { getMailbox } = await load();
    const { mailboxEmptyText } = await import("./messageTypes");
    const none = (await getMailbox({ box: "inbox", q: "없는 검색어" }))!;
    expect(none.items).toEqual([]);
    expect(mailboxEmptyText(none.box, none.q)).toBe("검색 결과가 없어요.");
    expect(mailboxEmptyText("inbox", "")).toBe("받은 쪽지함이 비어 있어요.");
    expect(mailboxEmptyText("sent", "")).toBe("보낸 쪽지가 비어 있어요.");
    expect(mailboxEmptyText("archive", "")).toBe("보관함이 비어 있어요.");
  });

  it("requires a session", async () => {
    const { getMailbox, sendMessage } = await load();
    signIn(null);
    expect(await getMailbox({})).toBeNull();
    expect((await sendMessage({ to: "c4", body: "안녕" })).status).toBe("UNAUTHORIZED");
  });
});
