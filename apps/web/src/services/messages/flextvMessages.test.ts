import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 9: 쪽지 and 쪽지 차단 on FLEXTV, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
vi.mock("@/lib/session", () => ({ getFlextvAccessToken: async () => "member-token", getSession: async () => ({ userId: "1" }) }));

const me = { id: 1, loginId: "viewer01", nickname: "시청자" };
const bj = { id: 2, loginId: "bj01", nickname: "방송인" };
let state: { verified: boolean; sent: { loginId: string; content: string }[]; blocked: Set<number>; deleted: string[] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (body: string) => new Response(body, { status: 200 });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvMessageRequests;
  state = { verified: true, sent: [], blocked: new Set(), deleted: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      switch (u.pathname) {
        case "/api/my/profile":
          return json({ luv: 0, numMsg: 3, profile: { ...me, PI: state.verified ? { isAdult: true } : null } });
        case "/api/my/messages":
          if (method === "POST") {
            state.sent.push(body);
            return text("OK");
          }
          return json({
            recipientData: [{ id: 11, content: "안녕하세요", createdAt: "2026-10-25T01:00:00.000Z", hasRead: 0, sender: bj, target: me }],
            sendData: [{ id: 12, content: "반가워요", createdAt: "2026-10-25T02:00:00.000Z", hasRead: 1, sender: me, target: bj }],
            recipientCount: 1,
            sendCount: 1
          });
        case "/api/channels/channel-find":
          return u.searchParams.get("loginId") === "bj01" ? json({ id: 3021, isInLive: true, nickname: "방송인", loginId: "bj01" }) : json({ message: "확인할 수 없는 계정입니다." }, 404);
        case "/api/subscribes":
          return json([{ id: 3021, name: "방송국", owner: bj, numberOfSubs: 1 }]);
        case "/api/my/messages/delete":
          state.deleted.push(u.searchParams.get("id")!);
          return text("ok");
        case "/api/my/member-messages-blackAdd":
          state.blocked.add(body.targetId);
          return text("ok");
        case "/api/my/member-messages-blackDelete":
          state.blocked.delete(body.targetId);
          return text("ok");
        case "/api/my/member-messages-blackList":
          return json({ data: [...state.blocked].map((id) => ({ id: 1, memberId: 1, targetId: id, loginId: "bj01", nickname: "방송인", createdAt: "2026-10-25T03:00:00.000Z" })), count: state.blocked.size });
        default:
          throw new Error(`unexpected FLEXTV call ${method} ${u.pathname}`);
      }
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the mailbox", () => {
  it("shows FLEXTV's 받은 · 보낸 쪽지 by the other party's 아이디", async () => {
    const { getMailbox } = await import("./messages");
    const inbox = (await getMailbox({}))!;
    expect(inbox).toMatchObject({ box: "inbox", total: 1, unread: 3, counts: { inbox: 1, sent: 1, archive: 0, spam: 0 } });
    expect(inbox.items).toEqual([{ id: "11", peerId: "bj01", peerName: "방송인", body: "안녕하세요", sentAt: "2026-10-25T01:00:00.000Z", read: false, direction: "IN" }]);
    // 보관함 and 스팸함 are FLEXTV's 받은 쪽지.
    expect((await getMailbox({ box: "spam" }))!.box).toBe("inbox");
    expect((await getMailbox({ box: "sent" }))!.items[0]).toMatchObject({ peerId: "bj01", direction: "OUT", read: true });
  });

  it("offers the 즐겨찾기's streamers and a room's 아이디", async () => {
    const { getMessageRecipients } = await import("./messages");
    expect(await getMessageRecipients()).toEqual([{ id: "bj01", name: "방송인" }]);
    expect(await getMessageRecipients("nobody")).toEqual([{ id: "bj01", name: "방송인" }]);
  });
});

describe("sending", () => {
  const send = async (to: string, requestId = "request-0000000000000001", body = "잘 보고 있어요") => (await import("./messages")).sendMessage({ to, body, requestId });

  it("sends to a streamer's 아이디, once per request id", async () => {
    expect(await send("bj01")).toEqual({ status: "SAVED" });
    expect(await send("bj01")).toEqual({ status: "SAVED" });
    expect(state.sent).toEqual([{ loginId: "bj01", content: "잘 보고 있어요" }]);
  });

  it("says why before FLEXTV would answer FAIL", async () => {
    expect(await send("viewer01", "request-0000000000000002")).toMatchObject({ status: "INVALID", message: "나에게는 쪽지를 보낼 수 없어요." });
    expect(await send("nobody", "request-0000000000000003")).toMatchObject({ status: "INVALID" });
    state.verified = false;
    expect(await send("bj01", "request-0000000000000004")).toMatchObject({ status: "INVALID", message: expect.stringContaining("본인인증") });
    expect(await send("bj01", "request-0000000000000005", " ")).toMatchObject({ status: "INVALID" });
    expect(state.sent).toEqual([]);
  });
});

describe("deleting and 차단", () => {
  it("deletes on FLEXTV, and does not move", async () => {
    const { deleteMessages, moveMessages } = await import("./messages");
    expect(await deleteMessages(["11", "bad"])).toEqual({ status: "SAVED" });
    expect(state.deleted).toEqual(["11"]);
    expect(await moveMessages({ ids: ["11"], to: "archive" })).toMatchObject({ status: "INVALID" });
  });

  it("blocks a sender by the 쪽지, and unblocks by the 아이디 — no member id reaches the browser", async () => {
    const { blockMessageSender } = await import("./messages");
    const { listBlocks, unblock } = await import("@/services/moderation/moderation");
    expect(await blockMessageSender("11")).toEqual({ status: "OK", name: "방송인" });
    expect(state.blocked).toEqual(new Set([2]));
    const blocks = (await listBlocks())!;
    expect(blocks).toEqual([{ id: "bj01", name: "방송인", since: "2026-10-25T03:00:00.000Z" }]);
    expect(await unblock("bj01")).toEqual({ status: "OK", name: "방송인" });
    expect(state.blocked.size).toBe(0);
    expect(await unblock("bj01")).toEqual({ status: "NOT_FOUND" });
  });
});
