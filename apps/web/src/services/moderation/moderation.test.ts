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
    expect(r.snapshot).toContain("룰렛");

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
    // One audit entry per closed report: the HIDE closed both reports on p-2.
    expect(m.auditEntries().map((e) => e.action)).toEqual(["REPORT_DISMISS", "REPORT_HIDE", "REPORT_HIDE"]);
    const hides = m.auditEntries().filter((e) => e.action === "REPORT_HIDE");
    expect(hides.map((e) => e.target).sort()).toEqual([`report:${first.id}`, "report:rp-other"].sort());
    expect(hides.find((e) => e.target === `report:${first.id}`)!.reason).toBe("광고 게시글 숨김");
    expect(hides.find((e) => e.target === "report:rp-other")!.reason).toBe(`광고 게시글 숨김 (신고 ${first.id} 처리로 함께 종료)`);

    await m.submitReport({ target: { type: "CREATOR", id: "c2" }, reason: "IMPERSONATION" });
    const creatorReport = (await m.listReports()).rows[0];
    expect((await m.decideReport(OP, { id: creatorReport.id, action: "HIDE", note: "채널 숨김" })).status).toBe("INVALID");
  });
});

describe("message authors", () => {
  beforeEach(() => resetMockStores());

  it("files mail under the sending creator's member id, so a report links the member and a block hides all their content", async () => {
    const m = await load();
    expect(await m.submitReport({ target: { type: "MESSAGE", id: "ms-1" }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    expect((await m.listReports()).rows[0]).toMatchObject({ authorId: "m-c4", authorName: "불꽃크루", authorIsMember: true });

    const { channelCommunityStore } = await import("@/services/creators/channelCommunityCore");
    await m.getChannelPosts("c1");
    channelCommunityStore().posts.push({ id: "cp-c4", creatorId: "c1", authorId: "m-c4", authorName: "불꽃크루", body: "합방 공지", createdAt: new Date().toISOString(), deleted: false });
    expect(await m.blockAuthorOf({ target: { type: "MESSAGE", id: "ms-1" } })).toEqual({ status: "OK", name: "불꽃크루" });
    expect((await m.getMailbox({ box: "inbox" }))!.items.some((x) => x.peerId === "c4")).toBe(false);
    expect((await m.getChannelPosts("c1"))!.items.some((p) => p.id === "cp-c4")).toBe(false);
  });

  it("lists blocks under their own ids, never the blocked member's id, and unblocks only by that id", async () => {
    const m = await load();
    await m.blockAuthorOf({ target: { type: "MESSAGE", id: "ms-1" } });
    const list = (await m.listBlocks())!;
    expect(list).toEqual([{ id: expect.stringMatching(/^[0-9a-f-]{36}$/), name: "불꽃크루", since: expect.any(String) }]);
    // The entry id is a random UUID (it can contain "c4" by chance): no field may be the member id or the creator id.
    expect(list.flatMap((e) => Object.values(e))).not.toEqual(expect.arrayContaining(["m-c4"]));
    expect(list.flatMap((e) => Object.values(e))).not.toEqual(expect.arrayContaining(["c4"]));
    expect(await m.unblock("m-c4")).toEqual({ status: "NOT_FOUND" });
    expect(await m.unblock(list[0].id)).toEqual({ status: "OK", name: "불꽃크루" });
    expect(await m.listBlocks()).toEqual([]);
  });

  it("refuses to block a channel (the room only offers 신고 for it)", async () => {
    const m = await load();
    expect((await m.blockAuthorOf({ target: { type: "CREATOR", id: "c1" } })).status).toBe("INVALID");
    expect(await m.listBlocks()).toEqual([]);
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

  it("blocks one sample fan of a channel, not the fans in the same place on other channels", async () => {
    const m = await load();
    const c1 = (await m.getChannelPosts("c1"))!;
    const c2 = (await m.getChannelPosts("c2"))!;
    expect(await m.blockAuthorOf({ target: { type: "CHANNEL_POST", id: c1.items[0].id } })).toMatchObject({ status: "OK", name: c1.items[0].authorName });
    expect((await m.getChannelPosts("c1"))!.total).toBe(c1.total - 1);
    expect((await m.getChannelPosts("c2"))!.items).toEqual(c2.items);
  });

  it("leaves a blocked commenter out of the board's comment count, as the post hides the comments", async () => {
    const m = await load();
    const count = async () => (await m.getBoard({})).items.find((p) => p.id === "p-1")!.commentCount;
    expect(await count()).toBe(1);
    expect(await m.blockAuthorOf({ target: { type: "COMMENT", id: "cm-1", parentId: "p-1" } })).toEqual({ status: "OK", name: "새벽라디오" });
    expect(await count()).toBe(0);
    expect(await m.getPost("p-1")).toMatchObject({ commentCount: 0, comments: [] });
  });
});
