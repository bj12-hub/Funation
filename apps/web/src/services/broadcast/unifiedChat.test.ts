import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 통합 채팅: every platform's chat in one feed, deduped, with capability-gated send / delete / ban. */
async function load() {
  const chat = await import("./unifiedChat");
  const yt = await import("@/services/creator/youtube");
  const remote = await import("@/services/platforms/mockBroadcastRemote");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  return { ...chat, ...yt, remote, overlayKey: mockCreator.integrationKey };
}

async function connectAll(m: Awaited<ReturnType<typeof load>>) {
  await m.connectYouTube({ handle: "streamer", requestId: key(900) });
  for (const platform of ["CHZZK", "SOOP", "FLEXTV"]) expect(await m.connectBroadcastChannel({ platform, handle: "streamer" })).toEqual({ status: "OK" });
}

const viewer = (n: number, platform: string, text: string, extra: Record<string, unknown> = {}) => ({ requestId: key(n), platform, nick: `시청자${n}`, text, ...extra });

describe("unified chat", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  it("declares per-platform chat capabilities instead of assuming they are the same", async () => {
    const m = await load();
    const view = (await m.getUnifiedChat())!;
    expect(view.platforms.map((p) => [p.platform, p.connected, p.canRead, p.canSend, p.canModerate, p.unverified])).toEqual([
      ["YOUTUBE", false, true, true, true, false],
      ["CHZZK", false, true, true, false, true],
      ["SOOP", false, true, false, false, true],
      ["FLEXTV", false, true, false, false, true]
    ]);
  });

  it("merges chat from every connected platform in arrival order, starting from the moment of connection", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "streamer", requestId: key(1) });
    const { broadcastChannelId } = await import("./channelsCore");
    // A message from before the CHZZK connection is not replayed.
    await m.connectBroadcastChannel({ platform: "CHZZK", handle: "streamer" });
    m.remote.mockViewerChat("CHZZK", broadcastChannelId("CHZZK")!, { userId: "early", nick: "먼저", text: "이전 메시지" });
    await m.disconnectBroadcastChannel({ platform: "CHZZK" });
    await connectAll(m);

    expect(await m.simulateViewerChat(viewer(2, "SOOP", "숲에서 안녕"))).toEqual({ status: "OK" });
    await m.simulateViewerChat(viewer(3, "YOUTUBE", "유튜브에서 안녕", { role: "MEMBER" }));
    await m.simulateViewerChat(viewer(4, "CHZZK", "치지직에서 안녕"));
    await m.simulateViewerChat(viewer(5, "FLEXTV", "플렉스에서 안녕"));

    const view = (await m.getUnifiedChat())!;
    expect(view.messages.map((x) => [x.platform, x.text])).toEqual([
      ["SOOP", "숲에서 안녕"],
      ["YOUTUBE", "유튜브에서 안녕"],
      ["CHZZK", "치지직에서 안녕"],
      ["FLEXTV", "플렉스에서 안녕"]
    ]);
    expect(view.messages[1].author.roles).toEqual(["MEMBER"]);
    expect(new Set(view.messages.map((x) => x.id)).size).toBe(4);
    expect(await m.getChatOverlay(m.overlayKey)).toHaveLength(4);
    expect(await m.getChatOverlay("wrong")).toBe("FORBIDDEN");
  });

  it("drops messages a platform re-delivers after a reconnect, and the same request id is applied once", async () => {
    const m = await load();
    await connectAll(m);
    await m.simulateViewerChat(viewer(10, "SOOP", "하나"));
    await m.simulateViewerChat(viewer(10, "SOOP", "하나"));
    await m.simulateViewerChat(viewer(11, "SOOP", "둘"));
    expect(await m.simulateChatReconnect({ platform: "SOOP" })).toEqual({ status: "OK" });
    const view = (await m.getUnifiedChat())!;
    expect(view.messages.map((x) => x.text)).toEqual(["하나", "둘"]);
    expect(view.platforms.find((p) => p.platform === "SOOP")).toMatchObject({ received: 2, duplicates: 2 });
  });

  it("sends to every chosen platform, reports unsupported ones and retries only the failed ones", async () => {
    const m = await load();
    await connectAll(m);
    m.remote.mockFailNextChatCall("CHZZK", "UNAVAILABLE");
    const req = { requestId: key(20), text: "모두 안녕하세요", platforms: ["YOUTUBE", "CHZZK", "SOOP"] };
    const first = await m.sendUnifiedChat(req);
    expect(first.status === "OK" && first.results).toMatchObject({ YOUTUBE: { status: "SENT" }, CHZZK: { status: "FAILED", code: "UNAVAILABLE" }, SOOP: { status: "UNSUPPORTED" } });

    const retry = await m.sendUnifiedChat(req);
    expect(retry.status === "OK" && retry.results).toMatchObject({ YOUTUBE: { status: "SENT" }, CHZZK: { status: "SENT" }, SOOP: { status: "UNSUPPORTED" } });
    const view = (await m.getUnifiedChat())!;
    // One echo per platform that accepted it — the retry did not post to YouTube twice.
    expect(view.messages.filter((x) => x.fromStudio).map((x) => x.platform)).toEqual(["YOUTUBE", "CHZZK"]);
    expect(view.messages.every((x) => x.author.roles.includes("OWNER"))).toBe(true);

    expect((await m.sendUnifiedChat({ ...req, text: "다른 내용" })).status).toBe("INVALID");
    expect((await m.sendUnifiedChat({ requestId: key(21), text: "", platforms: ["YOUTUBE"] })).status).toBe("INVALID");
    expect((await m.sendUnifiedChat({ requestId: key(22), text: "안녕", platforms: [] })).status).toBe("INVALID");
  });

  it("posts once for concurrent sends with one requestId and never resends a timed-out platform blindly", async () => {
    const m = await load();
    await connectAll(m);
    const { ChzzkAdapter, YouTubeAdapter } = await import("@/services/platforms/adapters");
    const ytSend = vi.spyOn(YouTubeAdapter, "sendChatMessage");
    const req = { requestId: key(60), text: "한 번만", platforms: ["YOUTUBE"] };
    const both = await Promise.all([m.sendUnifiedChat(req), m.sendUnifiedChat(req)]);
    expect(ytSend).toHaveBeenCalledTimes(1);
    for (const r of both) expect(["SENT", "PENDING"]).toContain(r.status === "OK" && r.results.YOUTUBE?.status);
    expect((await m.getUnifiedChat())!.messages.filter((x) => x.text === "한 번만")).toHaveLength(1);

    // A timeout may have posted it: reported as 확인 필요 and not sent again with the same requestId.
    m.remote.mockFailNextChatCall("CHZZK", "TIMEOUT");
    const late = { requestId: key(61), text: "응답이 늦어요", platforms: ["CHZZK"] };
    const first = await m.sendUnifiedChat(late);
    expect(first.status === "OK" && first.results.CHZZK).toEqual({ status: "UNCONFIRMED" });
    const chzSend = vi.spyOn(ChzzkAdapter, "sendChatMessage");
    const retry = await m.sendUnifiedChat(late);
    expect(retry.status === "OK" && retry.results.CHZZK).toEqual({ status: "UNCONFIRMED" });
    expect(chzSend).not.toHaveBeenCalled();
  });

  it("reads each channel from its own position: a switched channel shows everything after the switch, never the backlog", async () => {
    const m = await load();
    const { broadcastChannelId } = await import("./channelsCore");
    const { YouTubeAdapter } = await import("@/services/platforms/adapters");
    await m.connectYouTube({ handle: "alpha", requestId: key(70) });
    for (let i = 0; i < 3; i++) await m.simulateViewerChat(viewer(71 + i, "YOUTUBE", `old ${i}`));
    await m.disconnectYouTube();
    // The new channel already has chat from before the connection: not replayed.
    const beta = (await YouTubeAdapter.getChannel("betachan")).externalChannelId;
    m.remote.mockViewerChat("YOUTUBE", beta, { userId: "early", nick: "먼저", text: "연결 전" });
    await m.connectYouTube({ handle: "betachan", requestId: key(75) });
    await m.simulateViewerChat(viewer(76, "YOUTUBE", "new 1"));
    await m.simulateViewerChat(viewer(77, "YOUTUBE", "new 2"));

    // CHZZK switched to another channel without disconnecting first.
    await m.connectBroadcastChannel({ platform: "CHZZK", handle: "alpha" });
    for (let i = 0; i < 2; i++) await m.simulateViewerChat(viewer(78 + i, "CHZZK", `alpha ${i}`));
    await m.connectBroadcastChannel({ platform: "CHZZK", handle: "gamma" });
    expect(broadcastChannelId("CHZZK")).toContain("chz_");
    await m.simulateViewerChat(viewer(80, "CHZZK", "gamma 1"));

    const texts = (await m.getUnifiedChat())!.messages.map((x) => x.text);
    expect(texts).toEqual(["old 0", "old 1", "old 2", "new 1", "new 2", "alpha 0", "alpha 1", "gamma 1"]);
  });

  it("starts from now even when the first read fails or the overlay polls during the connection", async () => {
    const m = await load();
    const { ChzzkAdapter, SoopAdapter } = await import("@/services/platforms/adapters");
    const chz = (await ChzzkAdapter.getChannel("gamma")).externalChannelId;
    for (let i = 0; i < 3; i++) m.remote.mockViewerChat("CHZZK", chz, { userId: `u${i}`, nick: `n${i}`, text: `backlog ${i}` });
    m.remote.mockFailNextChatCall("CHZZK", "TIMEOUT");
    expect(await m.connectBroadcastChannel({ platform: "CHZZK", handle: "gamma" })).toEqual({ status: "OK" });
    expect(await m.getChatOverlay(m.overlayKey)).toEqual([]);
    await m.simulateViewerChat(viewer(80, "CHZZK", "after"));
    expect((await m.getChatOverlay(m.overlayKey)).map((l) => l.text)).toEqual(["after"]);

    // A slow platform: the overlay reads while the connection is still taking its first position.
    const soop = (await SoopAdapter.getChannel("delta")).externalChannelId;
    for (let i = 0; i < 3; i++) m.remote.mockViewerChat("SOOP", soop, { userId: `s${i}`, nick: `s${i}`, text: `soop backlog ${i}` });
    const read = SoopAdapter.fetchChatMessages.bind(SoopAdapter);
    vi.spyOn(SoopAdapter, "fetchChatMessages").mockImplementation(async (c, cur) => {
      await new Promise((r) => setTimeout(r, 30));
      return read(c, cur);
    });
    const connecting = m.connectBroadcastChannel({ platform: "SOOP", handle: "delta" });
    await new Promise((r) => setTimeout(r, 10));
    const { ingestChat, overlayLines } = await import("./chatCore");
    await ingestChat({ force: true });
    await connecting;
    expect(overlayLines().map((l) => l.text)).toEqual(["after"]);
  });

  it("drops malformed platform messages, counts them and keeps reading the rest", async () => {
    const m = await load();
    await connectAll(m);
    const { broadcastChannelId } = await import("./channelsCore");
    const soop = broadcastChannelId("SOOP")!;
    const chz = broadcastChannelId("CHZZK")!;
    m.remote.mockViewerChat("SOOP", soop, { userId: "a", nick: "a", text: "first" });
    // A badge we do not know yet, and a message without a usable time.
    m.remote.channelRemote(soop).soop.push({ chatNo: 9001, userId: "b", userNick: "b", userFlag: "subscriber" as never, message: "new badge", ts: Date.now() });
    m.remote.channelRemote(chz).chzzk.push({ messageId: "bad", senderChannelId: "x", profile: { nickname: "x", userRoleCode: "common_user", subscription: false }, content: "x", messageTime: Number.NaN });
    await m.simulateViewerChat(viewer(90, "SOOP", "after"));
    await m.simulateViewerChat(viewer(91, "CHZZK", "good"));
    const view = (await m.getUnifiedChat())!;
    expect(view.messages.map((x) => x.text)).toEqual(["first", "new badge", "after", "good"]);
    expect(view.messages[1].author.roles).toEqual([]);
    expect(view.platforms.find((p) => p.platform === "CHZZK")).toMatchObject({ skipped: 1, lastError: null });
  });

  it("hides locally on any platform, but deletes and bans only where the platform supports it", async () => {
    const m = await load();
    await connectAll(m);
    await m.simulateViewerChat(viewer(30, "YOUTUBE", "유튜브 도배"));
    await m.simulateViewerChat(viewer(30 + 1, "YOUTUBE", "또 도배", { nick: "시청자30" }));
    await m.simulateViewerChat(viewer(32, "SOOP", "숲 도배"));
    let view = (await m.getUnifiedChat())!;
    const [yt1, yt2, soop] = view.messages;

    expect(await m.hideChatMessage({ id: soop.id, hidden: true })).toEqual({ status: "OK" });
    expect(await m.deleteChatMessage({ id: soop.id })).toEqual({ status: "FAILED", message: expect.stringContaining("지원하지 않는") });
    expect((await m.banChatAuthor({ id: soop.id, durationSec: 300 })).status).toBe("FAILED");

    expect(await m.deleteChatMessage({ id: yt1.id })).toEqual({ status: "OK" });
    expect(await m.banChatAuthor({ id: yt2.id, durationSec: null })).toEqual({ status: "OK" });
    expect((await m.banChatAuthor({ id: yt2.id, durationSec: 12 })).status).toBe("INVALID");
    expect((await m.hideChatMessage({ id: yt1.id, hidden: false })).status).toBe("INVALID");

    view = (await m.getUnifiedChat())!;
    expect(view.messages.map((x) => x.hidden)).toEqual(["DELETED", "BANNED", "MANUAL"]);
    expect(view.log.map((l) => l.action)).toEqual(["BAN", "DELETE", "HIDE"]);
    expect(await m.getChatOverlay(m.overlayKey)).toEqual([]);
  });

  it("keeps one failing platform from blocking the others and auto-hides forbidden words", async () => {
    const m = await load();
    await connectAll(m);
    const { MOCK_FORBIDDEN_WORDS } = await import("@/services/account/mockStore");
    await m.simulateViewerChat(viewer(40, "CHZZK", "정상 메시지"));
    m.remote.mockFailNextChatCall("SOOP", "UNAVAILABLE");
    await m.simulateViewerChat(viewer(41, "FLEXTV", `나쁜말 ${MOCK_FORBIDDEN_WORDS[0]}`));
    const view = (await m.getUnifiedChat())!;
    expect(view.messages.map((x) => [x.platform, x.hidden])).toEqual([
      ["CHZZK", null],
      ["FLEXTV", "FILTER"]
    ]);
    expect(await m.getChatOverlay(m.overlayKey)).toHaveLength(1);
  });

  it("requires the creator role for every studio action", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.getUnifiedChat()).toBeNull();
    expect(await m.connectBroadcastChannel({ platform: "CHZZK", handle: "streamer" })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.sendUnifiedChat({ requestId: key(50), text: "안녕", platforms: ["YOUTUBE"] })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.banChatAuthor({ id: "x", durationSec: 300 })).toEqual({ status: "UNAUTHORIZED" });
  });
});
