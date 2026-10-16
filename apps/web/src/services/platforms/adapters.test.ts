import { beforeEach, describe, expect, it } from "vitest";
import { resetMockStores } from "@/test/mockEnv";

/** PlatformAdapter mapping: platform payloads are validated, and one bad item never breaks a batch. */
async function load() {
  const adapters = await import("./adapters");
  const remote = await import("./mockBroadcastRemote");
  return { ...adapters, remote };
}

describe("platform adapters", () => {
  beforeEach(() => resetMockStores());

  it("accepts only positive amounts within bounds, never guessing at a format", async () => {
    const { toAmount } = await load();
    const whole = { integer: true };
    expect(toAmount(1_000, whole)).toBe(1_000);
    expect(toAmount("1000", whole)).toBe(1_000);
    expect(toAmount(1.5, { integer: false })).toBe(1.5);
    for (const bad of ["1,000", "-5000", -1, 0, Number.NaN, Number.POSITIVE_INFINITY, 1.5, "", " 10", null, undefined, {}, 10_000_001]) {
      expect(toAmount(bad, whole)).toBeNull();
    }
  });

  it("drops and counts malformed donation events while mapping the rest in the platform's own unit", async () => {
    const m = await load();
    const chz = m.remote.channelRemote("chz-test");
    chz.chzzkDonations.push(
      { donationId: "ok", donatorChannelId: "a", donatorNickname: "치즈", payAmount: "1000", donationText: "hi", donatedAt: Date.now() },
      { donationId: "neg", donatorChannelId: "b", donatorNickname: "b", payAmount: "-5000", donationText: "", donatedAt: Date.now() },
      { donationId: "comma", donatorChannelId: "c", donatorNickname: "c", payAmount: "1,000", donationText: "", donatedAt: Date.now() },
      { donationId: "time", donatorChannelId: "d", donatorNickname: "d", payAmount: "1000", donationText: "", donatedAt: Number.NaN }
    );
    const first = await m.ChzzkAdapter.fetchDonationEvents("chz-test", null);
    expect(first.events.map((e) => [e.externalEventId, e.amount])).toEqual([["ok", { value: 1000, unit: "CHZZK_CHEESE" }]]);
    expect(first.skipped).toBe(3);
    // The cursor moves past the bad items.
    expect(await m.ChzzkAdapter.fetchDonationEvents("chz-test", first.cursor)).toMatchObject({ events: [], skipped: 0 });

    const soop = m.remote.channelRemote("soop-test");
    soop.soopBalloons.push(
      { balloonNo: 1, userId: "a", userNick: "a", count: "10" as unknown as number, message: "", ts: Date.now() },
      { balloonNo: 2, userId: "b", userNick: "b", count: 2.5, message: "", ts: Date.now() }
    );
    const balloons = await m.SoopAdapter.fetchDonationEvents("soop-test", null);
    expect(balloons.events.map((e) => e.amount)).toEqual([{ value: 10, unit: "SOOP_BALLOON" }]);
    expect(balloons.skipped).toBe(1);

    const flex = m.remote.channelRemote("flex-test");
    flex.flexDonations.push(
      { id: "f1", user: { id: "u", nick: "u" }, amount: "많이" as unknown as number, text: "", createdAt: new Date().toISOString() },
      { id: "f2", user: { id: "v", nick: "v" }, amount: 1.5, text: "", createdAt: new Date().toISOString() }
    );
    const flexEvents = await m.FlexTvAdapter.fetchDonationEvents("flex-test", null);
    expect(flexEvents).toMatchObject({ skipped: 1 });
    expect(flexEvents.events.map((e) => e.amount)).toEqual([{ value: 1.5, unit: "FLEXTV_UNIT" }]);

    m.mockYouTubeSuperChat("yt-test", { id: "sc-ok", donor: "a", message: "", value: 12.5, currency: "USD" });
    m.mockYouTubeSuperChat("yt-test", { id: "sc-nan", donor: "b", message: "", value: Number.NaN, currency: "USD" });
    m.mockYouTubeSuperChat("yt-test", { id: "sc-cur", donor: "c", message: "", value: 5, currency: "치즈" });
    const sc = await m.YouTubeAdapter.fetchDonationEvents("yt-test", null);
    expect(sc.events.map((e) => [e.externalEventId, e.amount])).toEqual([["sc-ok", { value: 12.5, unit: "USD" }]]);
    expect(sc.skipped).toBe(2);
  });

  it("maps an unknown badge to no role instead of breaking the message", async () => {
    const m = await load();
    const soop = m.remote.channelRemote("soop-chat");
    soop.soop.push({ chatNo: 1, userId: "a", userNick: "a", userFlag: "subscriber" as never, message: "새 배지", ts: Date.now() });
    soop.soop.push({ chatNo: 2, userId: "b", userNick: "b", userFlag: "constructor" as never, message: "이상한 배지", ts: Date.now() });
    const flex = m.remote.channelRemote("flex-chat");
    flex.flex.push({ id: "x", user: { id: "u", nick: "u", grade: "DIAMOND" as never }, text: "새 등급", createdAt: new Date().toISOString() });
    expect((await m.SoopAdapter.fetchChatMessages("soop-chat", null)).messages.map((x) => x.author.roles)).toEqual([[], []]);
    expect((await m.FlexTvAdapter.fetchChatMessages("flex-chat", null)).messages.map((x) => x.author.roles)).toEqual([[]]);
  });

  it("pages FlexTV's received-donation history (내역 이관) through core types; the others do not declare it", async () => {
    const m = await load();
    const history = await import("./mockHistoryRemote");
    expect(m.FlexTvAdapter.capabilities).toContain("DONATION_HISTORY");
    expect(m.FlexTvAdapter.unverified).toContain("DONATION_HISTORY");
    for (const a of [m.YouTubeAdapter, m.ChzzkAdapter, m.SoopAdapter]) {
      expect(a.capabilities).not.toContain("DONATION_HISTORY");
      await expect(a.fetchReceivedDonations("x", { cursor: null, since: null })).rejects.toMatchObject({ code: "UNSUPPORTED" });
    }

    const first = await m.FlexTvAdapter.fetchReceivedDonations("flex-hist", { cursor: null, since: null });
    expect(first).toMatchObject({ hasMore: true, skipped: 0 });
    expect(first.donations).toHaveLength(history.FLEX_HISTORY_PAGE);
    expect(Object.keys(first.donations[0]).sort()).toEqual(["amount", "donorName", "externalTransactionId", "message", "occurredAt", "platform"]);
    expect(first.donations[0]).toMatchObject({ platform: "FLEXTV", amount: { unit: "KRW" } });
    const rest = [];
    let cursor = first.cursor;
    for (;;) {
      const page = await m.FlexTvAdapter.fetchReceivedDonations("flex-hist", { cursor, since: null });
      rest.push(...page.donations);
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(first.donations.length + rest.length).toBe(45);
    // Nothing new yet: the cursor stays at the end and the next read is empty.
    expect(await m.FlexTvAdapter.fetchReceivedDonations("flex-hist", { cursor, since: null })).toMatchObject({ donations: [], hasMore: false, cursor });
    // `since` limits a read without a cursor.
    const last = rest[rest.length - 1];
    expect((await m.FlexTvAdapter.fetchReceivedDonations("flex-hist", { cursor: null, since: last.occurredAt })).donations.map((d) => d.externalTransactionId)).toEqual([last.externalTransactionId]);
  });

  it("drops a FlexTV history item without an id, donor name, real time or positive amount", async () => {
    const m = await load();
    const base = { giftNo: 1, sender: { id: "a", nick: "별빛" }, price: 1_000, currency: "KRW", memo: "안녕", giftedAt: "2026-10-01T10:00:00+09:00" };
    expect(m.mapFlexGiftHistory(base)).toEqual({ platform: "FLEXTV", externalTransactionId: "1", donorName: "별빛", message: "안녕", amount: { value: 1_000, unit: "KRW" }, occurredAt: "2026-10-01T01:00:00.000Z" });
    expect(m.mapFlexGiftHistory({ ...base, currency: "HEART", price: 2.5 })).toMatchObject({ amount: { value: 2.5, unit: "FLEXTV_UNIT" } });
    for (const bad of [{ giftNo: "" }, { sender: { id: "a", nick: " " } }, { price: "1,000" }, { price: 1.5 }, { price: -1 }, { giftedAt: "어제" }, { sender: null as never }]) {
      expect(m.mapFlexGiftHistory({ ...base, ...bad }), JSON.stringify(bad)).toBeNull();
    }
  });
});
