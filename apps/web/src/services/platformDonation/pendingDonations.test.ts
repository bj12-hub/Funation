import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 결과를 모르는 플랫폼 후원 (PENDING, FN 보관 — 2026-10-08 결정): the server re-checks the platform for 24 hours, lazily;
 * after that 확인 중 후원 lists it and an operator decides it. A failure returns the FN — never to a 재가입 account.
 */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };
const HOUR = 3_600_000;
const T0 = new Date("2026-10-08T03:00:00.000Z");

async function load(balance = 100_000) {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockPlatform } = await import("./mockPlatformStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { soopAdapter } = await import("./adapters");
  const { getWalletOverview } = await import("@/services/wallet/walletHistory");
  const { auditEntries } = await import("@/services/admin/auditCore");
  const { getAdminDashboard } = await import("@/services/admin/admin");
  const donation = await import("./platformDonation");
  const history = await import("./donationHistory");
  const admin = await import("@/services/admin/pendingDonations");
  mockAccount.fnBalance = balance;
  return { ...donation, ...history, ...admin, account: mockAccount, platform: mockPlatform, wallet: mockWallet, soopAdapter, getWalletOverview, auditEntries, getAdminDashboard };
}
type M = Awaited<ReturnType<typeof load>>;

const soop = (over: Record<string, unknown> = {}) => ({ platform: "SOOP", creatorId: "kim_stream", productId: "balloon-10", message: "응원해요", idempotencyKey: key(1), ...over });

/** A donation whose platform call failed after the hold: PENDING with 10,000 FN held. */
async function pending(m: M, over: Record<string, unknown> = {}) {
  vi.spyOn(m.soopAdapter, "sendDonation").mockRejectedValueOnce(new Error("ECONNRESET"));
  const res = await m.requestPlatformDonation(soop(over));
  if (res.status !== "PENDING") throw new Error(`expected PENDING, got ${res.status}`);
  return res.transactionId;
}
const txOf = (m: M, id: string) => m.platform.transactions.find((t) => t.transactionId === id)!;
const at = (ms: number) => vi.setSystemTime(new Date(T0.getTime() + ms));
const history = (m: M) => m.getDonationHistory({ period: "all" });

describe("확인 중 플랫폼 후원 (PENDING)", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records the hold in the wallet and keeps 처리중 while the platform has no result", async () => {
    const m = await load();
    const id = await pending(m);
    expect(m.wallet.donations.find((d) => d.id === id)).toMatchObject({ status: "PROCESSING", fnAmount: 10_000, typeLabel: "SOOP 별풍선 10개" });
    const lookup = vi.spyOn(m.soopAdapter, "lookupDonation").mockResolvedValue({ status: "UNKNOWN" });
    expect((await history(m))!.items.find((i) => i.transactionId === id)?.status).toBe("PROCESSING");
    expect(lookup).toHaveBeenCalledWith({ creatorId: "kim_stream", idempotencyKey: key(1), transactionId: id });
    // A lazy read asks at most once a minute.
    await history(m);
    expect(lookup).toHaveBeenCalledTimes(1);
    at(2 * 60_000);
    await history(m);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(m.account.fnBalance).toBe(90_000);
  });

  it("completes the donation when a re-check finds the platform completed it", async () => {
    const m = await load();
    const id = await pending(m);
    at(HOUR);
    // The mock platform answers deterministically: kim_stream's send went through, only its response was lost.
    const item = (await history(m))!.items.find((i) => i.transactionId === id)!;
    expect(item).toMatchObject({ status: "COMPLETED", externalTransactionId: "SP-LK-000001", failureReason: null });
    expect(txOf(m, id).resolution).toMatchObject({ outcome: "COMPLETED", by: "PLATFORM", fnReturn: null });
    expect(m.account.fnBalance).toBe(90_000);
    expect(m.wallet.donations.find((d) => d.id === id)?.status).toBe("COMPLETED");
    // The same key now answers with the result (결과 다시 확인 in the donation flow).
    expect(await m.requestPlatformDonation(soop())).toMatchObject({ status: "COMPLETED", transactionId: id, externalTransactionId: "SP-LK-000001" });
  });

  it("returns the held FN with a wallet record when a re-check finds the platform failed it", async () => {
    const m = await load();
    // 게임왕's sends fail on the mock platform, so its lookup answers FAILED.
    const id = await pending(m, { creatorId: "gameking" });
    expect(m.account.fnBalance).toBe(90_000);
    // The member's 결과 다시 확인 (same key) re-checks too.
    expect(await m.requestPlatformDonation(soop({ creatorId: "gameking" }))).toEqual({ status: "FAILED", reason: "API_ERROR" });
    expect(m.account.fnBalance).toBe(100_000);
    expect(txOf(m, id)).toMatchObject({ status: "FAILED", failureReason: "SOOP 확인 결과 실패 · FN 반환", resolution: { outcome: "FAILED", by: "PLATFORM", fnReturn: "RETURNED" } });
    const mirror = m.wallet.donations.find((d) => d.id === id)!;
    expect(mirror.status).toBe("REFUNDED");
    expect(mirror.refundedAt).toBeTruthy();
    const ledger = (await m.getWalletOverview({ kind: "REFUND", period: "all" }))!.entries;
    expect(ledger).toContainEqual(expect.objectContaining({ id: `${id}-refund`, kind: "REFUND", deltaFn: 10_000 }));
    // Settled once: later reads change nothing.
    await history(m);
    expect(m.account.fnBalance).toBe(100_000);
  });

  it("stops re-checking after 24 hours and lists the donation in 확인 중 후원", async () => {
    const m = await load();
    const id = await pending(m);
    const lookup = vi.spyOn(m.soopAdapter, "lookupDonation").mockRejectedValue(new Error("platform down"));
    at(23 * HOUR);
    await history(m);
    expect(lookup).toHaveBeenCalledTimes(1);
    // Only the sample row (a seed transaction already past its 24 h) is waiting.
    expect((await m.getPendingDonations()).waiting.map((r) => r.transactionId)).toEqual(["TXN-SEED-B12"]);
    expect((await m.getPendingDonations()).checking).toBe(1);

    at(24 * HOUR);
    await history(m);
    const view = await m.getPendingDonations();
    expect(lookup).toHaveBeenCalledTimes(1); // past 24 h nothing asks by itself
    expect(view.checking).toBe(0);
    expect(view.waiting.map((r) => r.transactionId)).toContain(id);
    expect(view.waiting.find((r) => r.transactionId === id)).toMatchObject({ platformLabel: "SOOP", fnAmount: 10_000, memberName: "홍길동", memberWithdrawn: false, resolution: null });
    expect((await m.getAdminDashboard())!.pending.platformDonations).toBe(view.waiting.length);
    // Still 처리중 for the member, FN still held.
    expect((await history(m))!.items.find((i) => i.transactionId === id)?.status).toBe("PROCESSING");
    expect(m.account.fnBalance).toBe(90_000);
  });

  it("lets an operator decide 실패 once, by request id, with a memo, and audits it", async () => {
    const m = await load();
    const id = await pending(m);
    vi.spyOn(m.soopAdapter, "lookupDonation").mockResolvedValue({ status: "UNKNOWN" });
    const decide = (over: Record<string, unknown> = {}) => m.resolvePendingDonation(OP, { transactionId: id, outcome: "FAILED", note: "플랫폼 고객센터 확인: 미전송", requestId: key(50), ...over });

    expect(await decide()).toEqual({ status: "INVALID", message: "요청 후 24시간이 지나지 않아 아직 플랫폼 결과를 자동으로 확인하고 있어요." });
    at(25 * HOUR);
    expect(await decide({ note: " " })).toEqual({ status: "INVALID", message: "처리 메모를 2~200자로 입력해 주세요." });
    expect(await decide({ outcome: "MAYBE" })).toEqual({ status: "INVALID", message: "성공 또는 실패를 골라 주세요." });
    expect(await decide({ requestId: "short" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await decide({ transactionId: "TXN-NOPE" })).toEqual({ status: "NOT_FOUND" });
    expect(m.account.fnBalance).toBe(90_000);

    expect(await decide()).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(100_000);
    expect(txOf(m, id)).toMatchObject({ status: "FAILED", failureReason: "운영자 확인 결과 실패 · FN 반환" });
    // A retry of the same request: OK, nothing more. Another decision: refused.
    expect(await decide()).toEqual({ status: "OK" });
    expect(await decide({ outcome: "COMPLETED" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await decide({ requestId: key(51) })).toEqual({ status: "INVALID", message: "이미 결과가 정해진 후원이에요 (실패)." });
    expect(m.account.fnBalance).toBe(100_000);

    const logged = m.auditEntries().filter((e) => e.action === "PLATFORM_DONATION_RESOLVE");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ actorName: "테스트 운영자", target: `platform-donation:${id}`, reason: "실패 · SOOP 별풍선 10개 · 10,000 FN · FN 반환 · 플랫폼 고객센터 확인: 미전송" });
    const view = await m.getPendingDonations();
    expect(view.waiting.map((r) => r.transactionId)).not.toContain(id);
    expect(view.resolved.find((r) => r.transactionId === id)?.resolution).toMatchObject({ outcome: "FAILED", by: "OPERATOR", operator: "테스트 운영자", fnReturn: "RETURNED" });
    expect((await history(m))!.items.find((i) => i.transactionId === id)?.status).toBe("FAILED");
  });

  it("lets an operator decide 성공: the held FN stay spent", async () => {
    const m = await load();
    const id = await pending(m);
    at(30 * HOUR);
    expect(await m.resolvePendingDonation(OP, { transactionId: id, outcome: "COMPLETED", note: "플랫폼에서 수신 확인", requestId: key(60) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(90_000);
    expect(txOf(m, id)).toMatchObject({ status: "COMPLETED", externalTransactionId: null });
    expect(m.wallet.donations.find((d) => d.id === id)?.status).toBe("COMPLETED");
    expect(await m.requestPlatformDonation(soop())).toMatchObject({ status: "COMPLETED", transactionId: id, externalTransactionId: null });
  });

  it("다시 확인 asks the platform for an item past 24 h and audits what it said", async () => {
    const m = await load();
    const id = await pending(m);
    at(26 * HOUR);
    const lookup = vi.spyOn(m.soopAdapter, "lookupDonation").mockResolvedValueOnce({ status: "UNKNOWN" });
    expect(await m.checkPendingDonation(OP, { transactionId: id })).toEqual({ status: "OK", outcome: "UNKNOWN" });
    expect(txOf(m, id).status).toBe("PROCESSING");
    lookup.mockRestore(); // the mock platform: completed
    expect(await m.checkPendingDonation(OP, { transactionId: id })).toEqual({ status: "OK", outcome: "COMPLETED" });
    expect(txOf(m, id)).toMatchObject({ status: "COMPLETED", resolution: { by: "PLATFORM" } });
    expect(await m.checkPendingDonation(OP, { transactionId: id })).toEqual({ status: "INVALID", message: "이미 결과가 정해진 후원이에요." });
    expect(m.auditEntries().filter((e) => e.action === "PLATFORM_DONATION_CHECK").map((e) => e.reason)).toEqual([
      "SOOP 별풍선 10개 · 10,000 FN · 플랫폼 확인: 완료",
      "SOOP 별풍선 10개 · 10,000 FN · 플랫폼 확인: 결과 없음"
    ]);
    // Settled after 24 h through 다시 확인: the console keeps it in its list.
    expect((await m.getPendingDonations()).resolved.map((r) => r.transactionId)).toContain(id);
  });

  it("never credits a 재가입 account: a failure after the sender withdrew is recorded as forfeited", async () => {
    const m = await load();
    const id = await pending(m);
    vi.spyOn(m.soopAdapter, "lookupDonation").mockResolvedValue({ status: "UNKNOWN" });
    // The member withdraws and someone signs up again in the slot (the mock's 재가입 keeps the user id).
    at(2 * HOUR);
    await rejoinWithPhone("010-0000-0000", new Date(T0.getTime() + 2 * HOUR));
    m.account.fnBalance = 3_000; // the new account's own FN
    // The new account's 후원 내역 does not show it (nor re-check it).
    expect((await history(m))!.items.map((i) => i.transactionId)).not.toContain(id);

    at(25 * HOUR);
    const row = (await m.getPendingDonations()).waiting.find((r) => r.transactionId === id)!;
    expect(row).toMatchObject({ memberName: "홍길동", memberWithdrawn: true, memberId: "u-hongGD123-w1" });
    expect(await m.resolvePendingDonation(OP, { transactionId: id, outcome: "FAILED", note: "미전송 확인", requestId: key(70) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(3_000);
    expect(txOf(m, id)).toMatchObject({ status: "FAILED", failureReason: "확인 결과 실패 · 탈퇴한 계정이라 FN 반환 불가(소멸)", resolution: { fnReturn: "FORFEITED" } });
    expect(m.auditEntries().find((e) => e.action === "PLATFORM_DONATION_RESOLVE")?.reason).toContain("반환 불가(탈퇴) · FN 소멸");
    expect((await m.getPendingDonations()).resolved.find((r) => r.transactionId === id)).toMatchObject({ memberWithdrawn: true, resolution: { fnReturn: "FORFEITED" } });
    // Nothing in the new account's wallet either.
    expect((await m.getWalletOverview({ kind: "REFUND", period: "all" }))!.entries.some((e) => e.id.startsWith(id))).toBe(false);
  });

  it("does not credit the slot while the sender is withdrawn, also when the platform answers FAILED", async () => {
    const m = await load();
    const id = await pending(m, { creatorId: "gameking" });
    const lookup = vi.spyOn(m.soopAdapter, "lookupDonation").mockResolvedValueOnce({ status: "UNKNOWN" });
    expect((await history(m))!.items.find((i) => i.transactionId === id)?.status).toBe("PROCESSING");
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 90_000, forfeitedEarningsFn: 0 });
    m.account.fnBalance = 0;
    lookup.mockRestore();
    at(5 * HOUR);
    await m.getPendingDonations(); // the console read re-checks every pending donation inside its 24 h
    expect(txOf(m, id)).toMatchObject({ status: "FAILED", resolution: { by: "PLATFORM", fnReturn: "FORFEITED" } });
    expect(m.account.fnBalance).toBe(0);
  });
});

/** 2026-10-09 결정: a settled PENDING donation notifies its member once, and a failure's FN 반환 is not shown as a refund. */
describe("확인 중 플랫폼 후원 · 사이트 알림과 FN 반환 표시 (2026-10-09 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** The 후원 notifications in the member's inbox (the header bell), newest first. */
  const donationNotices = async () => {
    const { listNotifications } = await import("@/services/notifications/notifications");
    return (await listNotifications({ show: 100 }))!.items.filter((n) => n.kind === "DONATION_SENT").map((n) => ({ title: n.title, body: n.body, href: n.href }));
  };

  it("notifies once when a re-check completes or fails it", async () => {
    const m = await load();
    const done = await pending(m);
    const failed = await pending(m, { creatorId: "gameking", idempotencyKey: key(2) });
    expect(await donationNotices()).toEqual([]);
    at(HOUR);
    await history(m); // the mock platform: kim_stream's went through, 게임왕's failed
    expect(await donationNotices()).toEqual(
      expect.arrayContaining([
        { title: "확인 중이던 후원이 완료됐어요", body: "SOOP · 김스트리머님께 10,000 FN", href: `/donation/history?period=all&tx=${done}` },
        { title: "확인 중이던 후원이 실패했어요", body: "SOOP · 게임왕님께 10,000 FN · FN 반환", href: `/donation/history?period=all&tx=${failed}` }
      ])
    );
    // Later reads, the same key again (결과 다시 확인) and the console change nothing.
    at(3 * HOUR);
    await history(m);
    await m.requestPlatformDonation(soop());
    await m.getPendingDonations();
    expect(await donationNotices()).toHaveLength(2);
  });

  it("notifies once for an operator's decision, not again for a retry of it", async () => {
    const m = await load();
    const id = await pending(m);
    vi.spyOn(m.soopAdapter, "lookupDonation").mockResolvedValue({ status: "UNKNOWN" });
    at(25 * HOUR);
    const decide = () => m.resolvePendingDonation(OP, { transactionId: id, outcome: "FAILED", note: "미전송 확인", requestId: key(80) });
    expect(await decide()).toEqual({ status: "OK" });
    expect(await decide()).toEqual({ status: "OK" });
    expect(await donationNotices()).toEqual([{ title: "확인 중이던 후원이 실패했어요", body: "SOOP · 김스트리머님께 10,000 FN · FN 반환", href: `/donation/history?period=all&tx=${id}` }]);
  });

  it("never notifies an account that has withdrawn, whatever the result", async () => {
    const m = await load();
    const done = await pending(m);
    const failed = await pending(m, { creatorId: "gameking", idempotencyKey: key(2) });
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 80_000, forfeitedEarningsFn: 0 });
    at(HOUR);
    await m.getPendingDonations(); // the console read re-checks both
    expect(txOf(m, done).status).toBe("COMPLETED");
    expect(txOf(m, failed).resolution).toMatchObject({ fnReturn: "FORFEITED" });
    expect(await donationNotices()).toEqual([]);
  });

  it("shows a failure's returned FN as FN 반환 in the FN 내역 and its CSV, and keeps real refunds as 환불완료", async () => {
    const m = await load();
    const id = await pending(m, { creatorId: "gameking" });
    at(HOUR);
    await history(m);
    expect(m.wallet.donations.find((d) => d.id === id)).toMatchObject({ status: "REFUNDED", fnReturned: true });

    // FN 후원내역 (/wallet/donations) and its CSV.
    const wallet = await import("@/services/wallet/walletHistory");
    const { parseHistoryParams } = await import("@/features/wallet/historyParams");
    const { period } = parseHistoryParams({ period: "year" });
    const rows = (await wallet.getDonationHistory({ period, category: "basic", all: true }))!.items;
    const row = rows.find((d) => d.id === id)!;
    expect(wallet.donationStatusLabel(row)).toBe("FN 반환");
    // The sample 시그니처 후원 refund (dn9) is a real refund.
    expect(wallet.donationStatusLabel(rows.find((d) => d.id === "dn9")!)).toBe("환불완료");
    const { GET } = await import("@/app/api/wallet/donations/route");
    const csv = await (await GET({ nextUrl: new URL("http://localhost/api/wallet/donations?period=year") } as never)).text();
    const lines = csv.split("\r\n");
    expect(lines.find((l) => l.includes("SOOP 별풍선 10개"))).toMatch(/,FN 반환$/);
    expect(lines.find((l) => l.includes("그림 방송 너무 힐링돼요"))).toMatch(/,환불완료$/);

    // FN Wallet list (every page): the 사용 row and the row that brings the FN back.
    const first = (await m.getWalletOverview({ kind: "all", period: "all" }))!;
    const entries = first.entries;
    for (let page = 2; page <= first.totalPages; page++) entries.push(...(await m.getWalletOverview({ kind: "all", period: "all", page }))!.entries);
    expect(entries.find((e) => e.id === id)).toMatchObject({ kind: "USE", statusLabel: "FN 반환" });
    expect(entries.find((e) => e.id === `${id}-refund`)).toMatchObject({ kind: "REFUND", description: "FN 반환 · SOOP 별풍선 10개", deltaFn: 10_000, statusLabel: "FN 반환" });
    expect(entries.find((e) => e.id === "dn9-refund")).toMatchObject({ description: "환불 · 시그니처 후원", statusLabel: "환불완료" });
  });
});
