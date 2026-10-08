import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원 연동: platform donation events → EXTERNAL alerts, deduped by event id, never FN. */
async function load() {
  const link = await import("./donationLink");
  const yt = await import("./youtube");
  const { mockAlerts } = await import("./alertCore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  mockAlerts.items.length = 0; // start from an empty queue (the mock seeds past donations)
  return { ...link, ...yt, alerts: mockAlerts, account: mockAccount, wallet: mockWallet };
}

const chat = (n: number, extra: Record<string, unknown> = {}) => ({ platform: "YOUTUBE", donor: "시청자", message: "화이팅", value: 5_000, currency: "KRW", requestId: key(n), ...extra });

describe("donation link", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  it("needs a connected, supported platform before it can be turned on", async () => {
    const m = await load();
    const view = (await m.getDonationLinks())!;
    // Only YouTube's donation events are confirmed against the real API; the others show 「API 확인 중」.
    expect(view.links.map((l) => [l.platform, l.supported, l.unverified, l.connected])).toEqual([
      ["YOUTUBE", true, false, false],
      ["CHZZK", true, true, false],
      ["SOOP", true, true, false],
      ["FLEXTV", true, true, false]
    ]);
    expect((await m.setDonationLink({ platform: "YOUTUBE", enabled: true })).status).toBe("INVALID");
    expect((await m.setDonationLink({ platform: "SOOP", enabled: true })).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(1))).status).toBe("INVALID");
  });

  it("queues one EXTERNAL alert per platform event, in its own currency, without touching FN", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "linked", requestId: key(2) });
    const balance = m.account.fnBalance;
    m.alerts.controls.minFn = 1_000_000;

    // Off: the event is not shown, and switching on later does not replay it.
    await m.simulateExternalDonation(chat(3));
    expect(m.alerts.items).toHaveLength(0);
    expect(await m.setDonationLink({ platform: "YOUTUBE", enabled: true })).toEqual({ status: "OK" });
    expect(await m.pollDonationLinks()).toEqual({ status: "OK", ingested: 0, duplicates: 0 });

    expect(await m.simulateExternalDonation(chat(4, { redeliver: true, value: 12.5, currency: "USD" }))).toEqual({ status: "OK", ingested: 1, duplicates: 1 });
    expect(await m.simulateExternalDonation(chat(4, { redeliver: true }))).toEqual({ status: "OK", ingested: 0, duplicates: 0 });
    expect(m.alerts.items).toHaveLength(1);
    expect(m.alerts.items[0]).toMatchObject({ kind: "EXTERNAL", fnAmount: 0, amountLabel: "US$12.50", typeLabel: "YouTube 슈퍼챗", status: "SHOWING" });

    const view = (await m.getDonationLinks())!;
    expect(view.links[0]).toMatchObject({ enabled: true, received: 1, duplicates: 1 });
    expect(view.recent[0]).toMatchObject({ donor: "시청자", amountLabel: "US$12.50" });
    expect(m.account.fnBalance).toBe(balance);
    expect(m.wallet.donations).toHaveLength(0);
  });

  it("puts every platform's donations into one alert queue, one at a time, deduped per platform event", async () => {
    const m = await load();
    const unified = await import("@/services/broadcast/unifiedChat");
    await m.connectYouTube({ handle: "linked", requestId: key(10) });
    for (const platform of ["CHZZK", "SOOP"]) {
      expect(await unified.connectBroadcastChannel({ platform, handle: "linked" })).toEqual({ status: "OK" });
      expect(await m.setDonationLink({ platform, enabled: true })).toEqual({ status: "OK" });
    }
    await m.setDonationLink({ platform: "YOUTUBE", enabled: true });
    m.alerts.controls.minFn = 1_000_000;

    expect(await m.simulateExternalDonation(chat(11, { platform: "SOOP", value: 10, redeliver: true }))).toEqual({ status: "OK", ingested: 1, duplicates: 1 });
    expect(await m.simulateExternalDonation(chat(12, { platform: "CHZZK", value: 1000 }))).toEqual({ status: "OK", ingested: 1, duplicates: 0 });
    expect(await m.simulateExternalDonation(chat(13, { platform: "YOUTUBE", value: 5000 }))).toEqual({ status: "OK", ingested: 1, duplicates: 0 });
    expect((await m.simulateExternalDonation(chat(14, { platform: "CHZZK", value: 1.5 }))).status).toBe("INVALID");

    expect(m.alerts.items.map((a) => [a.platform, a.typeLabel, a.amountLabel, a.status])).toEqual([
      ["SOOP", "SOOP 별풍선", "10 별풍선", "SHOWING"],
      ["CHZZK", "치지직 치즈", "1,000 치즈", "QUEUED"],
      ["YOUTUBE", "YouTube 슈퍼챗", "₩5,000", "QUEUED"]
    ]);
  });

  it("ties the read position to the channel: a new channel turns the link off and starts from now", async () => {
    const m = await load();
    const unified = await import("@/services/broadcast/unifiedChat");
    const { broadcastChannelId } = await import("@/services/broadcast/channelsCore");
    const remote = await import("@/services/platforms/mockBroadcastRemote");
    await unified.connectBroadcastChannel({ platform: "CHZZK", handle: "alpha" });
    await m.setDonationLink({ platform: "CHZZK", enabled: true });
    for (let i = 0; i < 3; i++) await m.simulateExternalDonation(chat(30 + i, { platform: "CHZZK", value: 1000 }));
    expect(m.alerts.items).toHaveLength(3);

    // Switched to another channel (no disconnect first): off until the creator turns it on for that channel.
    await unified.connectBroadcastChannel({ platform: "CHZZK", handle: "beta" });
    expect((await m.getDonationLinks())!.links[1]).toMatchObject({ platform: "CHZZK", connected: true, enabled: false });
    const beta = broadcastChannelId("CHZZK")!;
    remote.mockPlatformDonation("CHZZK", beta, { userId: "v0", nick: "켜기 전", amount: 500, message: "" });
    await m.setDonationLink({ platform: "CHZZK", enabled: true });
    remote.mockPlatformDonation("CHZZK", beta, { userId: "v1", nick: "새 채널 1", amount: 500, message: "" });
    remote.mockPlatformDonation("CHZZK", beta, { userId: "v2", nick: "새 채널 2", amount: 500, message: "" });
    expect(await m.pollDonationLinks()).toEqual({ status: "OK", ingested: 2, duplicates: 0 });
    expect(m.alerts.items.slice(3).map((a) => a.donor)).toEqual(["새 채널 1", "새 채널 2"]);

    // Disconnecting YouTube switches its link off too.
    await m.connectYouTube({ handle: "linked", requestId: key(40) });
    await m.setDonationLink({ platform: "YOUTUBE", enabled: true });
    await m.disconnectYouTube();
    expect((await m.getDonationLinks())!.links[0]).toMatchObject({ connected: false, enabled: false });
  });

  it("keeps one platform's failure or malformed event from blocking the others", async () => {
    const m = await load();
    const unified = await import("@/services/broadcast/unifiedChat");
    const { broadcastChannelId } = await import("@/services/broadcast/channelsCore");
    const remote = await import("@/services/platforms/mockBroadcastRemote");
    const { YouTubeAdapter } = await import("@/services/platforms/adapters");
    const { PlatformError } = await import("@/services/platforms/platformTypes");
    await m.connectYouTube({ handle: "linked", requestId: key(50) });
    await unified.connectBroadcastChannel({ platform: "CHZZK", handle: "linked" });
    await m.setDonationLink({ platform: "YOUTUBE", enabled: true });
    await m.setDonationLink({ platform: "CHZZK", enabled: true });
    const chz = broadcastChannelId("CHZZK")!;
    vi.spyOn(YouTubeAdapter, "fetchDonationEvents").mockRejectedValue(new PlatformError("TIMEOUT", "timeout"));
    remote.channelRemote(chz).chzzkDonations.push({ donationId: "bad-time", donatorChannelId: "x", donatorNickname: "x", payAmount: "1000", donationText: "", donatedAt: Number.NaN });
    remote.channelRemote(chz).chzzkDonations.push({ donationId: "negative", donatorChannelId: "x", donatorNickname: "x", payAmount: "-5000", donationText: "", donatedAt: Date.now() });
    remote.mockPlatformDonation("CHZZK", chz, { userId: "v", nick: "치즈 후원", amount: 1000, message: "" });

    const view = (await m.getDonationLinks())!;
    expect(m.alerts.items.map((a) => [a.donor, a.amountLabel])).toEqual([["치즈 후원", "1,000 치즈"]]);
    expect(view.links[0]).toMatchObject({ platform: "YOUTUBE", lastError: "TIMEOUT" });
    expect(view.links[1]).toMatchObject({ platform: "CHZZK", lastError: null, received: 1, skipped: 2 });
    // The bad events are behind the cursor now: the next poll does not trip over them again.
    expect(await m.pollDonationLinks()).toEqual({ status: "OK", ingested: 0, duplicates: 0 });
  });

  it("pulls platform donations from the alert overlay read, at most every few seconds", async () => {
    const m = await load();
    const { getOverlayAlert } = await import("./alertRemote");
    const { mockCreator } = await import("./mockCreatorStore");
    const { donationLinkStore } = await import("./donationLinkCore");
    const { mockYouTubeSuperChat } = await import("@/services/platforms/adapters");
    const { broadcastChannelId } = await import("@/services/broadcast/channelsCore");
    await m.connectYouTube({ handle: "linked", requestId: key(60) });
    await m.setDonationLink({ platform: "YOUTUBE", enabled: true });
    const yt = broadcastChannelId("YOUTUBE")!;
    mockYouTubeSuperChat(yt, { id: "sc-1", donor: "오버레이", message: "", value: 5000, currency: "KRW" });
    donationLinkStore().lastIngestAt = 0;
    await getOverlayAlert(mockCreator.integrationKey);
    expect(m.alerts.items.map((a) => a.donor)).toEqual(["오버레이"]);
    // Right after a read the overlay does not call the platforms again.
    mockYouTubeSuperChat(yt, { id: "sc-2", donor: "다음", message: "", value: 5000, currency: "KRW" });
    await getOverlayAlert(mockCreator.integrationKey);
    expect(m.alerts.items).toHaveLength(1);
  });

  it("validates the simulator and requires the creator role", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "linked", requestId: key(5) });
    expect((await m.simulateExternalDonation(chat(6, { value: -1 }))).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(7, { currency: "BTC" }))).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(8, { donor: "" }))).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(9, { platform: "SOOP" }))).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.getDonationLinks()).toBeNull();
    expect(await m.pollDonationLinks()).toEqual({ status: "UNAUTHORIZED" });
  });
});
