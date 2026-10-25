import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 후원 리스트 ↔ 후원 알림 대기열 (2026-10-25, StreamDonate 후원 및 통합 관리 참고 — 기본값): 미재생만 (where each listed
 * donation's alert is) and 미지정 일시정지 (a 미지정 donation's alert waits — the queue behind it too — until it is assigned).
 */
async function load() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const types = await import("./crewTypes");
  const remote = await import("@/services/creator/alertRemote");
  const { mockAlerts } = await import("@/services/creator/alertCore");
  const { setBankSms } = await import("@/services/bankSms/bankSms");
  const { receiveBankSms } = await import("@/services/bankSms/bankSmsCore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  // The session's donations go to the studio channel, the one whose overlay gets alerts (and whose crew goes live).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 500_000;
  mockAlerts.items.length = 0;
  expect(await setBankSms({ enabled: true })).toEqual({ status: "SAVED" });

  await feed.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
  await feed.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
  expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "테스트 방송", project: "", teamMode: false })).toEqual({ status: "SAVED" });
  const id = (await bc.getBroadcastView())!.live!.id;

  let n = 0;
  /** A 썸네이션 후원 with this message (a member keyword assigns it). */
  const send = async (message: string, amount = 1_000) =>
    expect(await requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message, voiceId: null, idempotencyKey: key(++n) })).toMatchObject({ status: "COMPLETED" });
  /** A 계좌 후원 (no message, so 미지정). */
  const bank = (depositor: string, amount = 10_000) => expect(receiveBankSms(`[신한] 10/25 11:20 입금 ${amount.toLocaleString("ko-KR")}원 잔액 ******원 ${depositor}`, null).status).toBe("OK");
  const entries = async () => (await bc.getBroadcastView())!.feed!.entries;
  /** Newest first: where each listed donation's alert is. */
  const alerts = async () => (await entries()).map((e) => e.alert);
  /** The alert on screen has been there long enough: the next read moves the queue on. */
  const expire = () => {
    mockAlerts.shownAt = Date.now() - 60_000;
  };
  const showing = () => mockAlerts.items.find((a) => a.status === "SHOWING")?.typeLabel ?? null;
  return { ...bc, ...feed, ...types, ...remote, mockAlerts, id, send, bank, entries, alerts, expire, showing };
}

describe("미재생만", () => {
  beforeEach(() => resetMockStores());

  it("knows where each listed donation's alert is in the queue", async () => {
    const m = await load();
    m.bank("별빛소나타"); // the queue is empty: on screen at once
    await m.send("길동 화이팅"); // waits its turn
    await m.simulateDonation({ broadcastId: m.id, requestId: key(50), amount: 3_000, message: "" }); // no alert of its own
    expect(await m.alerts()).toEqual([null, "QUEUED", "SHOWING"]);
    expect((await m.entries()).filter(m.feedUnplayed).map((e) => e.unit)).toEqual(["FN"]);

    m.expire();
    expect(await m.alerts()).toEqual([null, "SHOWING", "ENDED"]);
    m.expire();
    expect(await m.alerts()).toEqual([null, "ENDED", "ENDED"]);
    expect((await m.entries()).filter(m.feedUnplayed)).toEqual([]);

    // Skipped from the 리모컨, or under the 최소 금액: not waiting any more either.
    await m.setAlertControls({ minFn: 5_000 });
    await m.send("길동 또 왔어요", 1_000);
    expect((await m.alerts())[0]).toBe("ENDED");
  });
});

describe("미지정 일시정지", () => {
  beforeEach(() => resetMockStores());

  it("is off by default: a 미지정 donation's alert plays in its turn", async () => {
    const m = await load();
    expect((await m.getBroadcastView())!.feed!.pauseUnassigned).toBe(false);
    m.bank("별빛소나타");
    expect(await m.alerts()).toEqual(["SHOWING"]);
  });

  it("holds a 미지정 donation's alert, and the queue behind it, until the entry is assigned or cancelled", async () => {
    const m = await load();
    expect(await m.setPauseUnassigned({ broadcastId: m.id, on: true })).toEqual({ status: "SAVED" });
    m.bank("별빛소나타"); // 미지정: waits even though the queue is empty
    await m.send("길동 화이팅"); // assigned, but behind the held one
    expect(await m.alerts()).toEqual(["QUEUED", "HELD"]);
    expect(m.showing()).toBeNull();
    const remote = (await m.getRemoteView())!;
    expect(remote.queued.map((a) => !!a.held)).toEqual([true, false]);

    // Assigned: its alert plays, then the one behind it.
    const [, held] = await m.entries();
    expect(await m.assignFeedEntry({ broadcastId: m.id, entryId: held.id, memberId: "cm-s2" })).toEqual({ status: "SAVED" });
    expect(await m.alerts()).toEqual(["QUEUED", "SHOWING"]);
    // Taken back to 미지정 while on screen: nothing to hold any more.
    await m.assignFeedEntry({ broadcastId: m.id, entryId: held.id, memberId: null });
    expect(await m.alerts()).toEqual(["QUEUED", "SHOWING"]);

    // A 미지정 donation behind a playing one waits once it is next; cancelling the entry lets it play.
    m.bank("달빛고양이", 5_000);
    m.expire();
    expect(await m.alerts()).toEqual(["HELD", "SHOWING", "ENDED"]);
    m.expire();
    expect(await m.alerts()).toEqual(["HELD", "ENDED", "ENDED"]);
    expect(m.showing()).toBeNull();
    const [latest] = await m.entries();
    await m.cancelFeedEntry({ broadcastId: m.id, entryId: latest.id });
    expect((await m.alerts())[0]).toBe("SHOWING");
  });

  it("holds 확인 대기 entries too, and lets go when the option goes off, the broadcast ends or the operator plays it anyway", async () => {
    const m = await load();
    await m.setPauseUnassigned({ broadcastId: m.id, on: true });
    await m.setAssignMode({ broadcastId: m.id, mode: "CONFIRM" });
    await m.send("하늘 최고"); // 확인 대기 (keyword match, not yet confirmed)
    m.bank("별빛소나타");
    expect((await m.entries()).map((e) => e.status)).toEqual(["UNMATCHED", "PENDING"]);
    expect(await m.alerts()).toEqual(["HELD", "HELD"]);

    // 배정 없이 재생 of the second: it is let go but still waits behind the first, and is not held again.
    const [second, first] = await m.entries();
    expect(await m.playHeldEntry({ broadcastId: m.id, entryId: second.id })).toEqual({ status: "SAVED" });
    expect(await m.alerts()).toEqual(["QUEUED", "HELD"]);
    // Off: every held alert goes.
    await m.setPauseUnassigned({ broadcastId: m.id, on: false });
    expect(await m.alerts()).toEqual(["QUEUED", "SHOWING"]);
    await m.setPauseUnassigned({ broadcastId: m.id, on: true });
    expect(await m.alerts()).toEqual(["QUEUED", "SHOWING"]);
    expect(first.status).toBe("PENDING");

    // The 리모컨 can play a held alert too (by alert id).
    m.bank("달빛고양이", 5_000);
    const held = m.mockAlerts.items.find((a) => a.held)!;
    expect(held.typeLabel).toBe("계좌 후원");
    expect(await m.playHeldAlert({ alertId: held.id })).toEqual({ status: "SAVED" });
    expect(held.held).toBeUndefined();
    expect(await m.playHeldAlert({ alertId: held.id })).toEqual({ status: "SAVED" }); // no longer held: no-op

    // 한방: a donation in the pot does not hold; sent back to 미지정 (한방 취소) while still queued, it does.
    await m.startOneshot({ broadcastId: m.id });
    m.bank("초코쿠키", 3_000);
    expect((await m.alerts())[0]).toBe("QUEUED");
    await m.stopOneshot({ broadcastId: m.id, memberId: null });
    expect((await m.alerts())[0]).toBe("HELD");

    // The broadcast ends: held alerts play in their turn.
    expect(await m.endBroadcast(m.id)).toEqual({ status: "SAVED" });
    expect(m.mockAlerts.items.some((a) => a.held)).toBe(false);
  });

  it("is the creator's, for the live broadcast", async () => {
    const m = await load();
    expect((await m.setPauseUnassigned({ broadcastId: m.id, on: "yes" })).status).toBe("INVALID");
    expect((await m.setPauseUnassigned({ broadcastId: "bc-other", on: true })).status).toBe("INVALID");
    expect((await m.playHeldEntry({ broadcastId: m.id, entryId: "fd-none" })).status).toBe("INVALID");
    expect((await m.playHeldAlert({ alertId: 7 })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.setPauseUnassigned({ broadcastId: m.id, on: true })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.playHeldEntry({ broadcastId: m.id, entryId: "fd-none" })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.playHeldAlert({ alertId: "al-1" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
