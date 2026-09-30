import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 신고 · 차단: one report per member and target, blocks hide content; operators settle reports. */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

async function load() {
  const mod = await import("./moderation");
  const { moderationStore } = await import("./moderationCore");
  const reports = await import("@/services/admin/reports");
  const { getBoard, getPost } = await import("@/services/community/community");
  const { getMailbox } = await import("@/services/messages/messages");
  const { getChannelPosts } = await import("@/services/creators/channelHome");
  const { auditEntries } = await import("@/services/admin/auditCore");
  return { ...mod, ...reports, moderationStore, getBoard, getPost, getMailbox, getChannelPosts, auditEntries };
}

describe("reports", () => {
  beforeEach(() => resetMockStores());

  it("files one report per member and target with a snapshot, and refuses own or missing content", async () => {
    const m = await load();
    const target = { type: "POST", id: "p-2" };
    expect(await m.submitReport({ target, reason: "SPAM", detail: "광고 글이에요" })).toEqual({ status: "REPORTED" });
    expect(await m.submitReport({ target, reason: "ABUSE" })).toEqual({ status: "ALREADY_REPORTED" });
    const r = m.moderationStore().reports[0];
    expect(r).toMatchObject({ target: { type: "POST", id: "p-2" }, authorName: "새벽라디오", status: "OPEN", reporterId: "u-test" });
    expect(r.snapshot).toContain("럭키박스");

    expect((await m.submitReport({ target, reason: "NOPE" })).status).toBe("INVALID");
    expect((await m.submitReport({ target: { type: "POST", id: "p-3" }, reason: "ETC", detail: "" })).status).toBe("INVALID");
    expect(await m.submitReport({ target: { type: "POST", id: "nope" }, reason: "SPAM" })).toEqual({ status: "NOT_FOUND" });
    expect((await m.submitReport({ target: { type: "COMMENT", id: "c-1" }, reason: "SPAM" })).status).toBe("INVALID");
    expect(await m.submitReport({ target: { type: "MESSAGE", id: "ms-1" }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    expect((await m.submitReport({ target: { type: "MESSAGE", id: "ms-3" }, reason: "SPAM" })).status).toBe("NOT_FOUND");
    expect(await m.submitReport({ target: { type: "CREATOR", id: "c1" }, reason: "IMPERSONATION" })).toEqual({ status: "REPORTED" });
    signIn(null);
    expect(await m.submitReport({ target, reason: "SPAM" })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("lets operators hide the content (closing every open report on it) or dismiss, with audit", async () => {
    const m = await load();
    await m.submitReport({ target: { type: "POST", id: "p-2" }, reason: "SPAM" });
    signIn(["SUPPORTER"]);
    // A second reporter on the same post (the mock session id is shared, so fake another reporter).
    m.moderationStore().reports.push({ ...structuredClone(m.moderationStore().reports[0]), id: "rp-other", reporterId: "u-other" });
    await m.submitReport({ target: { type: "POST", id: "p-3" }, reason: "ABUSE" });

    const open = await m.listReports();
    expect(open.counts.OPEN).toBe(3);
    const first = open.rows.find((r) => r.target.id === "p-2")!;
    expect((await m.decideReport(OP, { id: first.id, action: "HIDE", note: "" })).status).toBe("INVALID");
    expect(await m.decideReport(OP, { id: first.id, action: "HIDE", note: "광고 게시글 숨김" })).toEqual({ status: "OK" });
    expect(await m.getPost("p-2")).toBeNull();
    const after = await m.listReports();
    expect(after.counts).toMatchObject({ OPEN: 1, ACTIONED: 2 });
    expect(await m.decideReport(OP, { id: first.id, action: "DISMISS", note: "뒤집기" })).toMatchObject({ status: "INVALID" });

    const other = after.rows[0];
    expect(await m.decideReport(OP, { id: other.id, action: "DISMISS", note: "위반 아님" })).toEqual({ status: "OK" });
    expect(await m.getPost("p-3")).not.toBeNull();
    expect(m.auditEntries().map((e) => e.action)).toEqual(["REPORT_DISMISS", "REPORT_HIDE"]);

    await m.submitReport({ target: { type: "CREATOR", id: "c2" }, reason: "IMPERSONATION" });
    const creatorReport = (await m.listReports()).rows[0];
    expect((await m.decideReport(OP, { id: creatorReport.id, action: "HIDE", note: "채널 숨김" })).status).toBe("INVALID");
  });
});

describe("blocking", () => {
  beforeEach(() => resetMockStores());

  it("hides a blocked author's posts, comments, channel posts and mail until unblocked", async () => {
    const m = await load();
    expect((await m.getBoard({})).items.some((p) => p.id === "p-2")).toBe(true);
    expect(await m.blockAuthorOf({ target: { type: "POST", id: "p-2" } })).toEqual({ status: "OK", name: "새벽라디오" });
    expect((await m.getBoard({})).items.some((p) => p.id === "p-2")).toBe(false);
    expect(await m.getPost("p-2")).toBeNull();

    expect((await m.getMailbox({ box: "inbox" }))!.items.some((x) => x.peerId === "c4")).toBe(true);
    await m.blockAuthorOf({ target: { type: "MESSAGE", id: "ms-1" } });
    const inbox = (await m.getMailbox({ box: "inbox" }))!;
    expect(inbox.items.some((x) => x.peerId === "c4")).toBe(false);
    expect((await m.getMailbox({ box: "sent" }))!.items.some((x) => x.peerId === "c4")).toBe(true);

    const posts = (await m.getChannelPosts("c1"))!;
    const victim = posts.items[0];
    await m.blockAuthorOf({ target: { type: "CHANNEL_POST", id: victim.id } });
    expect((await m.getChannelPosts("c1"))!.items.some((p) => p.id === victim.id)).toBe(false);

    const list = (await m.listBlocks())!;
    expect(list.map((b) => b.name)).toContain("새벽라디오");
    expect((await m.blockAuthorOf({ target: { type: "POST", id: "nope" } })).status).toBe("NOT_FOUND");
    const entry = list.find((b) => b.name === "새벽라디오")!;
    expect(await m.unblock(entry.id)).toEqual({ status: "OK", name: "새벽라디오" });
    expect((await m.getBoard({})).items.some((p) => p.id === "p-2")).toBe(true);
    expect(await m.unblock(entry.id)).toEqual({ status: "NOT_FOUND" });
    signIn(null);
    expect(await m.listBlocks()).toBeNull();
  });
});
