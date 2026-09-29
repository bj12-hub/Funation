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

  it("requires a session", async () => {
    const { getMailbox, sendMessage } = await load();
    signIn(null);
    expect(await getMailbox({})).toBeNull();
    expect((await sendMessage({ to: "c4", body: "안녕" })).status).toBe("UNAUTHORIZED");
  });
});
