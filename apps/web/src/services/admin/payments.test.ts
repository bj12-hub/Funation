import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 후원 · 결제 운영: final, logged refund decisions; approval takes back FN on the server. */
async function load() {
  const payments = await import("./payments");
  const { requestChargeRefund } = await import("@/services/wallet/refund");
  const { listChargeRecords, getWalletOverview } = await import("@/services/wallet/walletHistory");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
  const { startNewAccount } = await import("@/services/account/rejoin");
  const { auditEntries } = await import("./auditCore");
  const csvRoute = await import("@/app/api/wallet/charges/route");
  return { ...payments, requestChargeRefund, listChargeRecords, getWalletOverview, mockAccount, recordWithdrawal, startNewAccount, auditEntries, chargesCsv: csvRoute.GET };
}

const withdraw = (m: Awaited<ReturnType<typeof load>>) => {
  m.recordWithdrawal({ at: new Date().toISOString(), requestId: "test-withdrawal-0001", forfeitedFn: m.mockAccount.fnBalance, forfeitedEarningsFn: 0 });
  m.mockAccount.fnBalance = 0;
};

/**
 * The member asks for a refund of the newest completed charge. `balance`: the member's FN when asking — the sample
 * history spent the older charges, so the newest charge is unused up to that balance (환불 정책 기본값, FIFO).
 */
async function fileRefund(m: Awaited<ReturnType<typeof load>>, balance?: (chargeFn: number) => number) {
  signIn(["SUPPORTER"]);
  const charge = m.listChargeRecords().find((c) => c.status === "COMPLETED")!;
  if (balance) m.mockAccount.fnBalance = balance(charge.fnAmount);
  expect((await m.requestChargeRefund({ chargeId: charge.id, reason: "실수로 충전했어요" })).status).toBe("REQUESTED");
  signIn(["ADMIN"]);
  return charge;
}

/** Approves the amount the console shows now (as the admin app's 승인 does). */
async function approve(m: Awaited<ReturnType<typeof load>>, chargeId: string, note = "정상 환불") {
  const current = (await m.getPaymentsView())!.refunds.find((r) => r.chargeId === chargeId)?.current;
  return m.decideRefund(OP, { chargeId, decision: "APPROVE", note, expectedGrossFn: current?.grossFn, expectedNetFn: current?.netFn });
}

describe("admin payments", () => {
  beforeEach(() => resetMockStores());

  it("approves once, takes the FN back and shows the result to the member", async () => {
    const m = await load();
    const charge = await fileRefund(m, (fn) => fn + 1_000);
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({
      chargeId: charge.id,
      status: "REQUESTED",
      requested: { type: "FULL_CANCEL", grossFn: charge.fnAmount, feeFn: 0, netFn: charge.fnAmount, refundKrw: charge.paidAmount },
      current: { type: "FULL_CANCEL", grossFn: charge.fnAmount, feeFn: 0, netFn: charge.fnAmount, paidKrw: charge.paidAmount, refundKrw: charge.paidAmount },
      approved: null
    });
    expect((await approve(m, charge.id, "")).status).toBe("INVALID");
    expect(await approve(m, charge.id)).toEqual({ status: "OK" });
    expect(m.mockAccount.fnBalance).toBe(1_000);
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "정상 환불" })).toEqual({ status: "OK" }); // a retry
    expect(m.mockAccount.fnBalance).toBe(1_000);
    expect((await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "뒤집기" })).status).toBe("INVALID");
    expect(m.listChargeRecords().find((c) => c.id === charge.id)!.refund).toMatchObject({ status: "APPROVED" });
    const fn = `${charge.fnAmount.toLocaleString("ko-KR")} FN`;
    const krw = `${charge.paidAmount.toLocaleString("ko-KR")}원`;
    expect(m.auditEntries().map((e) => [e.action, e.reason])).toEqual([["REFUND_APPROVE", `전액 취소 · 회수 ${fn} · 수수료 0 FN · 환불 ${fn} · ${krw} · 정상 환불`]]);
  });

  it("states the refund policy for the console", async () => {
    const m = await load();
    signIn(["ADMIN"]);
    const { refundPolicy } = (await m.getPaymentsView())!;
    expect(refundPolicy.label).toBe("기본값 (일반적인 기준, 법무 검토 전)");
    expect(refundPolicy.summary).toContain("7일 이내");
    expect(refundPolicy.summary).toContain("수수료 10%");
    expect(refundPolicy.summary).toContain("원화 환불 금액은 환불 FN ÷ 충전 FN × 결제 금액, 원 미만 버림");
  });

  it("leaves a wallet record of the FN taken back, also in the charges CSV", async () => {
    const m = await load();
    const charge = await fileRefund(m, (fn) => fn);
    expect((await approve(m, charge.id)).status).toBe("OK");
    signIn(["SUPPORTER"]);
    const refunds = (await m.getWalletOverview({ kind: "REFUND", period: "all" }))!.entries;
    expect(refunds).toContainEqual(expect.objectContaining({ id: `${charge.id}-refund`, kind: "REFUND", deltaFn: -charge.fnAmount, statusLabel: "환불완료", tone: "refund" }));
    // Like a refunded donation: the charge row itself shows 환불완료, and the two rows add up to zero.
    const chargeRow = (await m.getWalletOverview({ kind: "CHARGE", period: "all" }))!.entries.find((e) => e.id === charge.id)!;
    expect(chargeRow).toMatchObject({ statusLabel: "환불완료", tone: "refund", deltaFn: charge.fnAmount });
    expect(chargeRow.deltaFn + refunds.find((e) => e.id === `${charge.id}-refund`)!.deltaFn).toBe(0);

    const { NextRequest } = await import("next/server");
    const csv = await (await m.chargesCsv(new NextRequest("http://localhost/api/wallet/charges?period=year"))).text();
    expect(csv).toContain("환불 상태");
    expect(csv.split(/\r?\n/).find((line) => line.includes(charge.transactionId!))).toContain("환불 완료");
  });

  it("labels a withdrawn member's request with the original nickname and 탈퇴, and does not decide it", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ memberName: "홍길동", memberWithdrawn: false });

    // 탈퇴: the request is no longer the slot's current member's (2026-10-08 결정: original nickname + 탈퇴 badge).
    withdraw(m);
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ chargeId: charge.id, memberName: "홍길동", memberWithdrawn: true, status: "REQUESTED" });
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "탈퇴 회원" })).toMatchObject({ status: "INVALID" });

    // 재가입: a new account holds the slot; the old request still belongs to the withdrawn one.
    m.startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    m.mockAccount.fnBalance = charge.fnAmount;
    const view = (await m.getPaymentsView())!.refunds[0];
    expect(view).toMatchObject({ memberName: "홍길동", memberWithdrawn: true, charge: { fnAmount: charge.fnAmount } });
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "환불 시도" })).toMatchObject({ status: "INVALID" });
    expect(m.mockAccount.fnBalance).toBe(charge.fnAmount);
    expect(m.auditEntries()).toEqual([]);
  });

  it("refuses to approve when the FN were spent after the request, and rejects with a note", async () => {
    const m = await load();
    const charge = await fileRefund(m); // the sample balance: 5,000 FN of the charge left
    // The 2026-10-08 example: 30,000 FN bought for 33,000원, 4,500 FN refunded → 4,950원.
    expect([charge.fnAmount, charge.paidAmount]).toEqual([30_000, 33_000]);
    expect((await m.getPaymentsView())!.refunds[0].requested).toEqual({ type: "PARTIAL", grossFn: 5_000, feeFn: 500, netFn: 4_500, refundKrw: 4_950 });
    m.mockAccount.fnBalance = 0; // spent since
    expect((await m.getPaymentsView())!.refunds[0].current).toMatchObject({ type: "NOT_REFUNDABLE" });
    expect((await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "환불 시도", expectedGrossFn: 5_000, expectedNetFn: 4_500 })).status).toBe("INVALID");
    expect(m.mockAccount.fnBalance).toBe(0);
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "이미 사용한 FN" })).toEqual({ status: "OK" });
    expect(m.listChargeRecords().find((c) => c.id === charge.id)!.refund).toMatchObject({ status: "REJECTED", note: "이미 사용한 FN" });
    expect(await m.decideRefund(OP, { chargeId: "nope", decision: "REJECT", note: "없음" })).toEqual({ status: "NOT_FOUND" });
  });

  it("points a withdrawn account's request to its `…-wN` member, not the new account in the slot", async () => {
    const m = await load();
    const { SAMPLE_MEMBER_ID, withdrawnMemberId } = await import("./memberCore");
    signInAs(SAMPLE_MEMBER_ID);
    await fileRefund(m);
    expect((await m.getPaymentsView())!.refunds[0].memberId).toBe(SAMPLE_MEMBER_ID);
    withdraw(m);
    expect((await m.getPaymentsView())!.refunds[0].memberId).toBe(SAMPLE_MEMBER_ID); // still the slot's (withdrawn) account
    m.startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ memberId: withdrawnMemberId(1), memberName: "홍길동", memberWithdrawn: true });
  });

  it("keeps a withdrawn account's charges and donations in the console under `…-w1` after a 재가입, labelled as before", async () => {
    const m = await load();
    const { getAdminDashboard } = await import("./admin");
    const { getMemberDetail } = await import("./members");
    const { SAMPLE_MEMBER_ID, withdrawnMemberId } = await import("./memberCore");
    const { mockWallet } = await import("@/services/wallet/mockWalletStore");
    signIn(["ADMIN"]);
    const name = m.mockAccount.nickname;
    const charges = (await m.getPaymentsView())!.charges;
    const donations = (await m.getDonationsView())!.rows;
    const dashboard = (await getAdminDashboard())!;
    const donated = (await getMemberDetail(SAMPLE_MEMBER_ID))!.member.donationTotalFn;
    expect(charges.length).toBeGreaterThan(0);
    expect(donated).toBeGreaterThan(0);
    expect(new Set([...charges, ...donations].map((r) => `${r.memberId} ${r.memberName}`))).toEqual(new Set([`${SAMPLE_MEMBER_ID} ${name}`]));

    withdraw(m);
    m.startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    const old = `${withdrawnMemberId(1)} ${name}`;
    expect((await m.getPaymentsView())!.charges.map((c) => `${c.memberId} ${c.memberName}`)).toEqual(charges.map(() => old));
    expect((await m.getDonationsView())!.rows.map((d) => `${d.memberId} ${d.memberName}`)).toEqual(donations.map(() => old));
    expect((await getAdminDashboard())!).toMatchObject({ charges: dashboard.charges, donations: dashboard.donations });
    expect((await getMemberDetail(withdrawnMemberId(1)))!.member.donationTotalFn).toBe(donated);
    expect((await getMemberDetail(SAMPLE_MEMBER_ID))!.member.donationTotalFn).toBe(0);

    // The new account's first charge is its own, in the console and in its wallet (which never shows the old ones).
    const { accountSince } = await import("@/services/account/withdrawalCore");
    mockWallet.charges.unshift({ id: "ch-new", chargedAt: accountSince()!, methodEmoji: "💳", methodLabel: "신용카드", methodDetail: null, fnAmount: 5_000, paidAmount: 5_500, status: "COMPLETED", transactionId: "TXN-NEW" });
    const after = (await m.getPaymentsView())!.charges;
    expect(after).toHaveLength(charges.length + 1);
    expect(after.find((c) => c.id === "ch-new")).toMatchObject({ memberId: SAMPLE_MEMBER_ID, memberName: "다시왔어요" });
    expect(m.listChargeRecords().map((c) => c.id)).toEqual(["ch-new"]);
  });

  it("builds charge and donation rows from the console's fields only (no messages or profile settings)", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    const charge = m.listChargeRecords().find((c) => c.status === "COMPLETED")!;
    await m.requestChargeRefund({ chargeId: charge.id, reason: "실수로 충전했어요" });
    signIn(["ADMIN"]);
    const { charges } = (await m.getPaymentsView())!;
    expect(Object.keys(charges[0]).sort()).toEqual(["chargedAt", "fnAmount", "id", "memberId", "memberName", "memberWithdrawn", "methodLabel", "paidAmount", "refund", "status", "transactionId"]);
    expect(charges.find((c) => c.id === charge.id)!.refund).toEqual({ status: "REQUESTED", requestedAt: expect.any(String) });
    const { rows } = (await m.getDonationsView())!;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["creatorName", "donatedAt", "fnAmount", "id", "memberId", "memberName", "memberWithdrawn", "status", "typeLabel"]);
  });

  it("summarises donations by status and type", async () => {
    const m = await load();
    signIn(["ADMIN"]);
    const v = (await m.getDonationsView())!;
    const total = Object.values(v.byStatus).reduce((s, x) => s + x.count, 0);
    expect(total).toBe(v.rows.length);
    expect(v.byType.reduce((s, t) => s + t.count, 0)).toBe(v.byStatus.COMPLETED.count);
    expect((await m.getDonationsView({ status: "REFUNDED" }))!.rows.every((d) => d.status === "REFUNDED")).toBe(true);
  });
});

describe("환불 요청 보류 · 보류 해제 (2026-10-08 결정)", () => {
  beforeEach(() => resetMockStores());

  const hold = (m: Awaited<ReturnType<typeof load>>, chargeId: string, n: number, note = "결제 도용 의심 확인") => m.holdRefund(OP, { chargeId, action: "HOLD", note, requestId: key(n) });
  const release = (m: Awaited<ReturnType<typeof load>>, chargeId: string, n: number, note = "본인 결제 확인") =>
    m.holdRefund(OP, { chargeId, action: "RELEASE", note, requestId: key(n) });
  const BLOCKED = { status: "INVALID", message: "보류 중인 환불 요청이라 승인 · 거절할 수 없어요. 보류를 해제한 뒤 처리해 주세요." };

  it("stops 승인 and 거절 while held, takes no FN, and 보류 해제 puts the request back as it was", async () => {
    const m = await load();
    const charge = await fileRefund(m, (fn) => fn + 1_000);
    const balance = m.mockAccount.fnBalance;
    expect(await hold(m, charge.id, 1)).toEqual({ status: "OK" });
    expect(await approve(m, charge.id)).toEqual(BLOCKED);
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "거절 시도" })).toEqual(BLOCKED);
    expect(m.mockAccount.fnBalance).toBe(balance);
    const held = (await m.getPaymentsView())!.refunds[0];
    expect(held).toMatchObject({ chargeId: charge.id, status: "REQUESTED", hold: { by: OP.nickname, note: "결제 도용 의심 확인" }, current: { type: "FULL_CANCEL" } });

    expect(await release(m, charge.id, 2)).toEqual({ status: "OK" });
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ status: "REQUESTED", hold: null, requested: held.requested });
    expect(await approve(m, charge.id)).toEqual({ status: "OK" });
    expect(m.mockAccount.fnBalance).toBe(1_000);
    expect(m.auditEntries().map((e) => e.action)).toEqual(["REFUND_APPROVE", "REFUND_RELEASE", "REFUND_HOLD"]);
  });

  it("is idempotent by request id, needs a memo and is audited", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    expect(await hold(m, charge.id, 1, " ")).toEqual({ status: "INVALID", message: "보류 메모를 2~200자로 입력해 주세요." });
    expect(await m.holdRefund(OP, { chargeId: charge.id, action: "HOLD", note: "확인 필요" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await hold(m, "nope", 1)).toEqual({ status: "NOT_FOUND" });
    expect(await hold(m, charge.id, 1)).toEqual({ status: "OK" });
    expect(await hold(m, charge.id, 1)).toEqual({ status: "OK" }); // a retry
    expect(await hold(m, charge.id, 2)).toEqual({ status: "INVALID", message: "이미 보류 중인 환불 요청이에요." });
    expect(await release(m, charge.id, 1)).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await release(m, charge.id, 3)).toEqual({ status: "OK" });
    expect(await release(m, charge.id, 3)).toEqual({ status: "OK" }); // a retry
    expect(await release(m, charge.id, 4)).toEqual({ status: "INVALID", message: "보류 중인 환불 요청이 아니에요." });
    expect(m.auditEntries().map((e) => [e.action, e.target, e.reason])).toEqual([
      ["REFUND_RELEASE", `refund:${charge.id}`, "본인 결제 확인"],
      ["REFUND_HOLD", `refund:${charge.id}`, "결제 도용 의심 확인"]
    ]);

    // Decided requests and a withdrawn account's request (처리 불가) are not held.
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "이미 사용한 FN" })).toEqual({ status: "OK" });
    expect(await hold(m, charge.id, 5)).toEqual({ status: "INVALID", message: "심사 대기 중인 환불 요청만 보류할 수 있어요." });
  });

  it("does not hold a withdrawn account's request", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    withdraw(m);
    expect(await hold(m, charge.id, 1)).toEqual({ status: "INVALID", message: "탈퇴한 회원의 환불 요청이라 보류할 수 없어요." });
    expect(m.auditEntries()).toEqual([]);
  });

  it("leaves held requests out of 처리 대기 and counts them as 보류, on the dashboard too", async () => {
    const m = await load();
    const { getAdminDashboard } = await import("./admin");
    const charge = await fileRefund(m);
    expect(m.refundQueue()).toEqual({ waiting: 1, blocked: 0, held: 0 });
    await hold(m, charge.id, 1);
    expect(m.refundQueue()).toEqual({ waiting: 0, blocked: 0, held: 1 });
    expect((await getAdminDashboard())!.pending).toMatchObject({ refunds: 0, refundsBlocked: 0, refundsHeld: 1 });
    await release(m, charge.id, 2);
    expect((await getAdminDashboard())!.pending).toMatchObject({ refunds: 1, refundsHeld: 0 });
  });

  it("keeps showing the member 심사 중 without the memo, and still keeps the account from withdrawing", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    await hold(m, charge.id, 1, "운영자만 보는 보류 메모");
    signIn(["SUPPORTER"]);
    const refund = m.listChargeRecords().find((c) => c.id === charge.id)!.refund!;
    expect(refund).toMatchObject({ status: "REQUESTED" });
    expect(JSON.stringify(refund)).not.toContain("운영자만 보는 보류 메모");
    const overview = await m.getWalletOverview({ kind: "CHARGE", period: "all" });
    expect(JSON.stringify(overview)).not.toContain("운영자만 보는 보류 메모");
    const { getWithdrawalInfo } = await import("@/services/account/withdrawal");
    expect(await getWithdrawalInfo()).toMatchObject({ pendingRefunds: 1 });
  });
});

describe("이용 정지 중인 회원의 충전 환불 (2026-10-08 결정)", () => {
  beforeEach(() => resetMockStores());

  it("decides a suspended member's refund requests as usual", async () => {
    const m = await load();
    const { SAMPLE_MEMBER_ID, isMemberSuspended } = await import("./memberCore");
    const { suspendMember } = await import("./members");
    const charge = await fileRefund(m, (fn) => fn + 1_000);
    expect(await suspendMember(OP, { id: SAMPLE_MEMBER_ID, days: null, reason: "결제 관련 운영정책 위반", requestId: key(1) })).toEqual({ status: "OK" });
    expect(isMemberSuspended(SAMPLE_MEMBER_ID)).toBe(true);
    expect(m.refundQueue()).toEqual({ waiting: 1, blocked: 0, held: 0 });
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ memberWithdrawn: false, current: { type: "FULL_CANCEL" } });
    expect(await approve(m, charge.id)).toEqual({ status: "OK" });
    expect(m.mockAccount.fnBalance).toBe(1_000);
    expect(m.listChargeRecords().find((c) => c.id === charge.id)!.refund).toMatchObject({ status: "APPROVED" });
    expect(m.auditEntries().map((e) => e.action)).toEqual(["REFUND_APPROVE", "MEMBER_SUSPEND"]);
  });
});
