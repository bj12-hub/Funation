import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, settleSamplePlatformDonations, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * 처리 중 충전 (2026-10-12 결정): an FN 충전 still 처리중 waits for the payment provider's confirmation, which the mock never
 * gives by itself. The console lists it; an operator decides 결제 확인 (FN 지급) or 결제 취소 (미지급) with a memo, once, by
 * request id, audited. The sample's ch1 (신용카드 10,000 FN) is the mock's only one.
 */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };
const PASSWORD = "password"; // the mock account's initial password (services/account/mockStore.ts)
const NOTE = "결제 대행사 관리자 화면에서 승인 확인";
const all = { kind: "CHARGE", period: "all" } as const;

async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const pending = await import("./pendingCharges");
  const { getAdminDashboard } = await import("./admin");
  const { getPaymentsView } = await import("./payments");
  const { auditEntries } = await import("./auditCore");
  const { chargeDecisions } = await import("./pendingChargeCore");
  const { listChargeRecords, getWalletOverview, CHARGE_STATUS_LABEL } = await import("@/services/wallet/walletHistory");
  const { quoteChargeRefund, requestChargeRefund } = await import("@/services/wallet/refund");
  const { unusedPaidFnByCharge } = await import("@/services/wallet/refundCore");
  const { getWithdrawalInfo, withdrawAccount } = await import("@/services/account/withdrawal");
  return {
    ...pending,
    account: mockAccount,
    getAdminDashboard,
    getPaymentsView,
    auditEntries,
    chargeDecisions,
    listChargeRecords,
    getWalletOverview,
    CHARGE_STATUS_LABEL,
    quoteChargeRefund,
    requestChargeRefund,
    unusedPaidFnByCharge,
    getWithdrawalInfo,
    withdrawAccount
  };
}
type M = Awaited<ReturnType<typeof load>>;

const decide = (m: M, over: Record<string, unknown> = {}) => m.resolvePendingCharge(OP, { chargeId: "ch1", outcome: "COMPLETED", note: NOTE, requestId: key(20), ...over });
const ch1 = (m: M) => m.listChargeRecords().find((c) => c.id === "ch1");
const supporter = (n: number, fnBalance: number) => ({ requestId: key(900 + n), confirmed: true, forfeitAgreed: true, fnBalance, unsettledFn: 0, password: PASSWORD });

describe("처리 중 충전 (2026-10-12 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["SUPPORTER"]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("lists the 처리중 charge with its member, amount, method, request time and transaction id, and counts it on the dashboard", async () => {
    const m = await load();
    const charge = ch1(m)!;
    expect(charge.status).toBe("PROCESSING");
    const view = await m.getPendingCharges();
    expect(view.resolved).toEqual([]);
    expect(view.waiting).toEqual([
      {
        chargeId: "ch1",
        chargedAt: charge.chargedAt,
        methodLabel: "신용카드",
        fnAmount: 10_000,
        paidAmount: 11_000,
        transactionId: charge.transactionId,
        memberId: "u-hongGD123",
        memberName: "홍길동",
        memberWithdrawn: false,
        resolution: null
      }
    ]);
    expect(charge.transactionId).toMatch(/^TXN-\d{8}-\d{5}$/);
    expect((await m.getAdminDashboard())!.pending.processingCharges).toBe(1);
  });

  it("결제 확인 credits the FN once, records the decision, audits it, and the member sees 완료 with a refundable charge", async () => {
    const m = await load();
    const tx = ch1(m)!.transactionId;
    expect(await decide(m)).toEqual({ status: "OK", result: "CREDITED" });
    expect(m.account.fnBalance).toBe(15_000);

    // The console: nothing waits, the decision is listed with its memo and operator.
    const view = await m.getPendingCharges();
    expect(view.waiting).toEqual([]);
    expect(view.resolved).toEqual([
      expect.objectContaining({ chargeId: "ch1", fnAmount: 10_000, paidAmount: 11_000, transactionId: tx, memberWithdrawn: false, resolution: { outcome: "COMPLETED", result: "CREDITED", at: expect.any(String), operator: "테스트 운영자", note: NOTE } })
    ]);
    expect((await m.getAdminDashboard())!.pending.processingCharges).toBe(0);
    expect((await m.getPaymentsView())!.charges.find((c) => c.id === "ch1")).toMatchObject({ status: "COMPLETED", fnNotCredited: false, paidAmount: 11_000 });
    const logged = m.auditEntries().filter((e) => e.action === "PENDING_CHARGE_RESOLVE");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ actorName: "테스트 운영자", target: "charge:ch1", reason: `결제 확인 · 신용카드 10,000 FN · 11,000원 · 거래번호 ${tx} · FN 지급 · ${NOTE}` });

    // The member: 완료 in 충전 내역 and the FN Wallet, and the charge can be refunded like any completed one.
    const charge = ch1(m)!;
    expect(charge).toMatchObject({ status: "COMPLETED", paidAmount: 11_000, transactionId: tx });
    expect(m.CHARGE_STATUS_LABEL[charge.status]).toBe("완료");
    expect((await m.getWalletOverview(all))!.entries.find((e) => e.id === "ch1")).toMatchObject({ deltaFn: 10_000, statusLabel: "완료", tone: "done" });
    expect(await m.quoteChargeRefund({ chargeId: "ch1" })).toMatchObject({ status: "QUOTE", quote: { type: "FULL_CANCEL", grossFn: 10_000, netFn: 10_000, refundKrw: 11_000 } });
  });

  it("결제 취소 credits nothing; the member sees 취소, the charge cannot be refunded and the refund ledger is unchanged", async () => {
    const m = await load();
    const tx = ch1(m)!.transactionId;
    const ledger = [...m.unusedPaidFnByCharge()];
    expect(await decide(m, { outcome: "CANCELLED", note: "결제 대행사 확인: 미결제" })).toEqual({ status: "OK", result: "CANCELLED" });
    expect(m.account.fnBalance).toBe(5_000);

    // The member: 취소 — nothing was paid, there is no transaction, and there is nothing to refund.
    const charge = ch1(m)!;
    expect(charge).toMatchObject({ status: "CANCELLED", paidAmount: 0, transactionId: null });
    expect(m.CHARGE_STATUS_LABEL[charge.status]).toBe("취소");
    expect((await m.getWalletOverview(all))!.entries.find((e) => e.id === "ch1")).toMatchObject({ statusLabel: "취소", tone: "failed" });
    const refused = { status: "INVALID", message: "완료된 충전만 환불을 요청할 수 있어요." };
    expect(await m.quoteChargeRefund({ chargeId: "ch1" })).toEqual(refused);
    expect(await m.requestChargeRefund({ chargeId: "ch1", expectedGrossFn: 10_000, expectedNetFn: 10_000 })).toEqual(refused);
    // No paid FN of ch1 in the ledger, and every other charge's unused FN as before.
    expect(m.unusedPaidFnByCharge().has("ch1")).toBe(false);
    expect([...m.unusedPaidFnByCharge()]).toEqual(ledger);

    // The console keeps what was decided: the amount and transaction id the charge waited with.
    expect((await m.getPendingCharges()).resolved).toEqual([
      expect.objectContaining({ chargeId: "ch1", paidAmount: 11_000, transactionId: tx, resolution: expect.objectContaining({ outcome: "CANCELLED", result: "CANCELLED", note: "결제 대행사 확인: 미결제" }) })
    ]);
    expect((await m.getPaymentsView())!.charges.find((c) => c.id === "ch1")).toMatchObject({ status: "CANCELLED", fnNotCredited: false });
    expect(m.auditEntries().find((e) => e.action === "PENDING_CHARGE_RESOLVE")?.reason).toBe(`결제 취소 · 신용카드 10,000 FN · 11,000원 · 거래번호 ${tx} · 미지급 · 결제 대행사 확인: 미결제`);
  });

  it("validates the input, decides once, and answers a retry by request id only when it carries the same charge, outcome and memo", async () => {
    const m = await load();
    expect(await decide(m, { requestId: "short" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await decide(m, { note: " " })).toEqual({ status: "INVALID", message: "처리 메모를 2~200자로 입력해 주세요." });
    expect(await decide(m, { note: "가".repeat(201) })).toEqual({ status: "INVALID", message: "처리 메모를 2~200자로 입력해 주세요." });
    expect(await decide(m, { outcome: "MAYBE" })).toEqual({ status: "INVALID", message: "결제 확인 또는 결제 취소를 골라 주세요." });
    expect(await decide(m, { chargeId: "nope" })).toEqual({ status: "NOT_FOUND" });
    expect(await decide(m, { chargeId: "ch2" })).toEqual({ status: "INVALID", message: "이미 처리된 충전이에요 (완료)." });
    expect(await decide(m, { chargeId: "ch6" })).toEqual({ status: "INVALID", message: "이미 처리된 충전이에요 (취소)." });
    expect(m.account.fnBalance).toBe(5_000);
    expect(m.auditEntries()).toEqual([]);

    expect(await decide(m, { note: `  ${NOTE} ` })).toEqual({ status: "OK", result: "CREDITED" });
    // The same request again (a lost response): the same answer, nothing more.
    expect(await decide(m)).toEqual({ status: "OK", result: "CREDITED" });
    // Anything else under that id is not that decision.
    expect(await decide(m, { outcome: "CANCELLED" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await decide(m, { note: "다른 메모로 다시 결정" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await decide(m, { chargeId: "ch2" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    // A new request: the charge is decided already, whichever outcome.
    expect(await decide(m, { requestId: key(21) })).toEqual({ status: "INVALID", message: "이미 처리된 충전이에요 (완료)." });
    expect(await decide(m, { requestId: key(22), outcome: "CANCELLED" })).toEqual({ status: "INVALID", message: "이미 처리된 충전이에요 (완료)." });

    expect(m.account.fnBalance).toBe(15_000);
    expect(m.auditEntries().filter((e) => e.action === "PENDING_CHARGE_RESOLVE")).toHaveLength(1);
    expect(m.chargeDecisions().decisions).toHaveLength(1);
    expect(m.chargeDecisions().decisions[0]).toMatchObject({ requestId: key(20), note: NOTE });
  });

  it("never credits an account that has withdrawn: 결제 확인 is recorded as 완료 · FN 미지급 (탈퇴)", async () => {
    const m = await load();
    // The account went around the 탈퇴 block (records the withdrawal directly): it still has its balance on record.
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 5_000, forfeitedEarningsFn: 0 });
    expect((await m.getPendingCharges()).waiting).toEqual([expect.objectContaining({ chargeId: "ch1", memberId: "u-hongGD123", memberName: "홍길동", memberWithdrawn: true })]);
    expect(await decide(m)).toEqual({ status: "OK", result: "NOT_CREDITED" });
    expect(m.account.fnBalance).toBe(5_000);
    expect((await m.getPendingCharges()).resolved).toEqual([expect.objectContaining({ memberWithdrawn: true, resolution: expect.objectContaining({ outcome: "COMPLETED", result: "NOT_CREDITED" }) })]);
    expect((await m.getPaymentsView())!.charges.find((c) => c.id === "ch1")).toMatchObject({ status: "COMPLETED", fnNotCredited: true, memberWithdrawn: true });
    expect(m.auditEntries().find((e) => e.action === "PENDING_CHARGE_RESOLVE")?.reason).toContain(" · FN 미지급 (탈퇴) · ");
  });

  it("does not credit a 재가입 account either, and keeps the withdrawn account's decision until its payment records go", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = new Date("2026-10-12T03:00:00.000Z");
    vi.setSystemTime(t0);
    const m = await load();
    await rejoinWithPhone("010-0000-0000", t0);
    expect(m.account.fnBalance).toBe(0);
    const row = (await m.getPendingCharges()).waiting.find((r) => r.chargeId === "ch1");
    expect(row).toMatchObject({ memberId: "u-hongGD123-w1", memberName: "홍길동", memberWithdrawn: true });
    // The new account has no such charge, so nothing holds its 탈퇴.
    expect(m.listChargeRecords().some((c) => c.id === "ch1")).toBe(false);
    expect((await m.getWithdrawalInfo())!.pendingCharges).toBe(0);

    expect(await decide(m)).toEqual({ status: "OK", result: "NOT_CREDITED" });
    expect(m.account.fnBalance).toBe(0);
    expect((await m.getWalletOverview({ period: "all" }))!.entries).toEqual([]);
    expect((await m.getPaymentsView())!.charges.find((c) => c.id === "ch1")).toMatchObject({ status: "COMPLETED", fnNotCredited: true, memberId: "u-hongGD123-w1", memberWithdrawn: true });

    // 대금결제 기록 (5년, 기본값): once the withdrawn account's payment records go, so does the decision (the audit entry stays).
    vi.setSystemTime(new Date("2031-10-13T03:00:00.000Z"));
    expect(await m.getPendingCharges()).toEqual({ waiting: [], resolved: [] });
    expect(m.chargeDecisions().decisions).toEqual([]);
    expect(m.auditEntries().filter((e) => e.action === "PENDING_CHARGE_RESOLVE")).toHaveLength(1);
  });

  it("lets the sample member withdraw on the dev server once ch1 is decided (결제 취소)", async () => {
    const m = await load();
    await settleSamplePlatformDonations(); // the sample PENDING 플랫폼 후원 is another block (2026-10-09 결정)
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 5_000, pendingCharges: 1 });
    expect(await m.withdrawAccount(supporter(1, 5_000))).toEqual({ status: "CHARGE_PENDING", count: 1 });
    expect(await decide(m, { outcome: "CANCELLED", note: "결제 대행사 확인: 미결제" })).toEqual({ status: "OK", result: "CANCELLED" });
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 5_000, pendingCharges: 0 });
    expect(await m.withdrawAccount(supporter(2, 5_000))).toEqual({ status: "WITHDRAWN" });
  });

  it("lets the sample member withdraw once ch1 is decided (결제 확인), for the balance with its FN", async () => {
    const m = await load();
    await settleSamplePlatformDonations();
    expect(await decide(m)).toEqual({ status: "OK", result: "CREDITED" });
    expect(await m.getWithdrawalInfo()).toMatchObject({ fnBalance: 15_000, pendingCharges: 0 });
    expect(await m.withdrawAccount(supporter(1, 15_000))).toEqual({ status: "WITHDRAWN" });
  });

  it("dates the confirmed charge's FN in the refund ledger when they landed, not when the charge was requested", async () => {
    // Server dates by fake timers; the sample history is dated before the store's creation (t0).
    vi.useFakeTimers({ toFake: ["Date"] });
    const at = (h: number) => new Date(2026, 9, 12, 10 + h, 0, 0);
    vi.setSystemTime(at(0));
    const m = await load();
    const { agreeChargeTerms, requestCharge } = await import("@/services/wallet/charge");
    const { requestDonation } = await import("@/services/donations/donate");
    expect((await agreeChargeTerms({ guardian: true, privacy: true, payment: true })).status).toBe("AGREED");
    // ch1 was requested yesterday and is still 처리중. 11:00 the member charges 5,000 FN (completed at once).
    vi.setSystemTime(at(1));
    const live = await requestCharge({ amount: { customAmount: 5_000 }, methodId: "KAKAO_PAY", idempotencyKey: key(1) });
    if (live.status !== "COMPLETED") throw new Error(live.status);
    // 12:00 ch1's payment is confirmed in the console: its 10,000 FN land now, after the 5,000.
    vi.setSystemTime(at(2));
    expect(await decide(m)).toEqual({ status: "OK", result: "CREDITED" });
    // 13:00 the member donates 12,000 FN; 8,000 FN are left.
    vi.setSystemTime(at(3));
    expect(await requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 12_000, message: "", voiceId: null, idempotencyKey: key(2) })).toMatchObject({ status: "COMPLETED" });
    expect(m.account.fnBalance).toBe(8_000);

    // The FN received last are the ones left: all from ch1; the 5,000 FN charge before it are used.
    vi.setSystemTime(at(4));
    expect(await m.quoteChargeRefund({ chargeId: "ch1" })).toMatchObject({ status: "QUOTE", quote: { type: "PARTIAL", usedFn: 2_000, grossFn: 8_000, feeFn: 800, netFn: 7_200, refundKrw: 7_920 } });
    expect(await m.quoteChargeRefund({ chargeId: `ch-${live.transactionId}` })).toMatchObject({ status: "QUOTE", quote: { type: "NOT_REFUNDABLE", usedFn: 5_000 } });
  });
});

describe("처리 중 충전 · admin API (/api/admin/pending-charges)", () => {
  const TOKEN = "test-admin-api-token-00000000000000";
  const headers = (extra: Record<string, string> = {}) => ({
    authorization: `Bearer ${TOKEN}`,
    "x-admin-operator-id": "adm-1",
    "x-admin-operator-name": encodeURIComponent("테스트 운영자"),
    "content-type": "application/json",
    ...extra
  });
  const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) });

  beforeEach(() => {
    resetMockStores();
    vi.stubEnv("ADMIN_API_TOKEN", TOKEN);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("serves the list and records a decision with the operator; refuses without the secret", async () => {
    const list = await import("@/app/api/admin/pending-charges/route");
    const resolve = await import("@/app/api/admin/pending-charges/[chargeId]/resolve/route");
    const res = await list.GET(new Request("http://x/api/admin/pending-charges", { headers: headers() }), ctx({}));
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).waiting.map((r: { chargeId: string }) => r.chargeId)).toEqual(["ch1"]);

    const body = JSON.stringify({ outcome: "CANCELLED", note: "결제 대행사 확인: 미결제", requestId: key(5) });
    const post = (h: Record<string, string>, chargeId = "ch1") => resolve.POST(new Request("http://x", { method: "POST", headers: h, body }), ctx({ chargeId }));
    expect((await post(headers({ authorization: "Bearer nope" }))).status).toBe(401);
    expect(await (await post(headers())).json()).toEqual({ status: "OK", result: "CANCELLED" });
    expect(await (await post(headers(), "ch1")).json()).toEqual({ status: "OK", result: "CANCELLED" }); // the retry
    const { auditEntries } = await import("./auditCore");
    expect(auditEntries().map((e) => [e.action, e.actorId, e.target])).toEqual([["PENDING_CHARGE_RESOLVE", "adm-1", "charge:ch1"]]);
  });
});
