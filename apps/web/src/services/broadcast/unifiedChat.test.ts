import { beforeEach, describe, expect, it, vi } from "vitest";
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
    m.remote.mockFailNextChatCall("CHZZK", "TIMEOUT");
    const req = { requestId: key(20), text: "모두 안녕하세요", platforms: ["YOUTUBE", "CHZZK", "SOOP"] };
    const first = await m.sendUnifiedChat(req);
    expect(first.status === "OK" && first.results).toMatchObject({ YOUTUBE: { status: "SENT" }, CHZZK: { status: "FAILED", code: "TIMEOUT" }, SOOP: { status: "UNSUPPORTED" } });

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
