"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { clearPasswordFailures, currentAccountKey, isPasswordLocked, recordPasswordFailure } from "@/services/auth/loginLockCore";
import { getSession, hasRole, revokeSession, type Session } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { mockQuests } from "@/services/donations/questCore";
import { mockPlatform } from "@/services/platformDonation/mockPlatformStore";
import { awaitsResult, recheckAccountPending } from "@/services/platformDonation/pendingCore";
import { pendingCharges } from "@/services/wallet/chargeCore";
import { inFlightCount, settleInFlight } from "@/services/wallet/inFlightCore";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { mockAccount, mockCredentials } from "./mockStore";
import { unsettledFn } from "./withdrawalApply";
import { accountSince, isWithdrawn, withdrawalStore } from "./withdrawalCore";
import { WITHDRAWAL_GRACE_DAYS, type PendingQuests, type WithdrawResult, type WithdrawalInfo } from "./withdrawalTypes";

/**
 * 회원 탈퇴 — code-first, route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05:
 * 크리에이터 정산 대기 수익도 소멸 동의, 탈퇴 직전 비밀번호 재입력). The server re-checks the session, every consent
 * and the password, takes the consents only for exactly the amounts the member saw, and ends the session. One request
 * id per intended withdrawal, so a retry after a lost response gets the same answer. Rate limiting of password attempts
 * belongs to the backend; accounts that only use social login re-confirm with that login (provider hand-off TBD).
 * 2026-10-06 결정: while an FN 충전 환불 request of this account waits for an operator, withdrawal is refused (the
 * member withdraws once it is decided).
 * 2026-10-08 결정: while a 퀘스트 후원 is in progress (FN held, no result yet), withdrawal is refused too — for quests the
 * member sent (a failed or cancelled quest refunds the slot's balance, which after a 재가입 is a new account's) and, for
 * a creator, quests sent to the channel (the supporters' FN waits for the channel's decision). The member withdraws
 * once each has a result; nothing about the quests themselves changes here.
 * 2026-10-09 결정: while a 플랫폼 후원 of this account is PENDING (no platform result yet, FN held — a failure returns the
 * FN to the slot's balance, which after a 재가입 is a new account's), withdrawal is refused too, until the re-check or an
 * operator settles it (platformDonation/pendingCore.ts) — and so while its platform call is still running (another tab),
 * whose refusal would return the FN the same way. Opening the screen and pressing 탈퇴 both re-check first.
 * 2026-10-10 결정: while an FN 충전 of this account is in progress — its payment provider call still running, or 처리중
 * waiting for the payment to be confirmed (wallet/chargeCore.ts) — withdrawal is refused too, until it completes or
 * fails, and so while an 출석 보상 is on its way to the balance (wallet/inFlightCore.ts). Opening the screen and pressing
 * 탈퇴 first wait a moment for those on their way to land, so both show the state after them. A credit that completes
 * after a withdrawal anyway lands on nobody (the charge is kept for the console, the 출석 보상 is not paid).
 * 2026-11-01 사용자 결정 (FLEXTV 조건 기본안) — 회원탈퇴 유예 (탈퇴 철회): pressing 탈퇴 passes every check above as
 * before but only stores a 탈퇴 신청 and ends the session (`REQUESTED` with its `effectiveAt`). The 탈퇴 takes effect
 * exactly 30 days later (WITHDRAWAL_GRACE_DAYS), when ./withdrawalApply.ts forfeits and deletes what this did at once
 * before; during the 30 days (기본값) the account and its data stay as they are, cannot be used, and signing in with
 * the password can cancel the request (services/auth/login.ts `cancelWithdrawal`).
 * Retention (./retentionPolicy.ts — 기본값, 플렉스티비 기준, 법무 검토 전): the withdrawal record with the consents, the
 * payment, dispute and access records and the 본인 확인 값 stay until their dates (./retentionPurge.ts — counted from
 * the day the 탈퇴 took effect), posts stay up under "탈퇴한 회원"; every other piece of personal data goes then.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Withdrawal API is not connected yet.");
};

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

const DAY_MS = 86_400_000;

/**
 * The answer a 탈퇴 신청 with this id already got (a retry after a lost response): the same `REQUESTED`, while it waits
 * for its date and after it was applied (the record keeps the request id; its `at` is the request's `effectiveAt`).
 */
function sameRequest(requestId: string): WithdrawResult | null {
  const { request, withdrawal } = withdrawalStore();
  if (request?.requestId === requestId) return { status: "REQUESTED", effectiveAt: request.effectiveAt };
  if (withdrawal?.requestId === requestId) return { status: "REQUESTED", effectiveAt: withdrawal.at };
  return null;
}

/** The slot account has asked already (its 30 days are running or over) or has withdrawn. */
const requestedOrWithdrawn = () => withdrawalStore().request !== null || isWithdrawn();

/** This account's FN 충전 환불 requests still waiting for an operator. */
const pendingRefunds = () => mockRefunds.requests.filter((r) => r.status === "REQUESTED" && r.accountSince === accountSince()).length;

/** 퀘스트 후원 in progress: sent by this member, and (creators) sent to their channel — the studio's in the mock. */
function pendingQuests(session: Session): PendingQuests {
  const running = mockQuests.items.filter((q) => q.status === "IN_PROGRESS");
  return {
    sent: running.filter((q) => q.supporterUserId === session.userId).length,
    received: hasRole(session, "CREATOR") ? running.filter((q) => q.channelId === STUDIO_CHANNEL).length : 0
  };
}

/**
 * This account's 플랫폼 후원 still waiting for their result, FN held: PENDING, and also one whose platform call is still
 * running (another tab) — a refusal would put its FN back into the slot after the 탈퇴.
 */
const pendingPlatformDonations = () => mockPlatform.transactions.filter((t) => awaitsResult(t) && (t.account ?? null) === accountSince()).length;

const questProblem = (session: Session): WithdrawResult | null => {
  const quests = pendingQuests(session);
  return quests.sent + quests.received > 0 ? { status: "QUEST_PENDING", ...quests } : null;
};

/** This account's 출석 보상 on their way to the balance (2026-10-10 결정). */
const pendingAttendanceRewards = () => inFlightCount("ATTENDANCE");

/**
 * FN on its way to this account (2026-10-10 결정): a charge in progress (provider call or 처리중) or an 출석 보상 not paid
 * yet. Synchronous — the final check runs it in the step that writes the withdrawal.
 */
function creditProblem(): WithdrawResult | null {
  const charges = pendingCharges();
  if (charges > 0) return { status: "CHARGE_PENDING", count: charges };
  const rewards = pendingAttendanceRewards();
  return rewards > 0 ? { status: "ATTENDANCE_PENDING", count: rewards } : null;
}

export async function getWithdrawalInfo(): Promise<WithdrawalInfo | null> {
  assertMock();
  const session = await getSession();
  if (!session) return null;
  // Opening the screen re-checks this account's PENDING 플랫폼 후원 as 후원 내역 does (inside their 24 h, at most once a
  // minute each): a result that has come in settles it, so it no longer blocks the withdrawal.
  await recheckAccountPending();
  // A charge or an 출석 보상 on its way gets a moment to land (2026-10-10 결정), so the screen shows the balance after it
  // and a card only for what is still in progress.
  await settleInFlight();
  await mockDelay(200);
  const creator = hasRole(session, "CREATOR");
  return {
    nickname: mockAccount.nickname,
    fnBalance: mockAccount.fnBalance,
    creator,
    unsettledFn: creator ? unsettledFn() : 0,
    pendingRefunds: pendingRefunds(),
    pendingQuests: pendingQuests(session),
    pendingPlatformDonations: pendingPlatformDonations(),
    pendingCharges: pendingCharges(),
    pendingAttendanceRewards: pendingAttendanceRewards()
  };
}

/** The consents cover the amounts the member saw; amounts that changed since need a new look. */
function consentProblem(v: Record<string, unknown>, balance: number, earnings: number): WithdrawResult | null {
  if (v.fnBalance !== balance) return { status: "INVALID", message: "남은 FN이 바뀌었어요. 금액을 다시 확인해 주세요." };
  if ((v.unsettledFn ?? 0) !== earnings) return { status: "INVALID", message: "정산 대기 수익이 바뀌었어요. 금액을 다시 확인해 주세요." };
  if (balance > 0 && v.forfeitAgreed !== true) return { status: "INVALID", message: "남은 FN 소멸에 동의해 주세요." };
  if (earnings > 0 && v.earningsForfeitAgreed !== true) return { status: "INVALID", message: "정산 대기 수익 소멸에 동의해 주세요." };
  return null;
}

const earningsOf = (session: Session) => (hasRole(session, "CREATOR") ? unsettledFn() : 0);

export async function withdrawAccount(input: unknown): Promise<WithdrawResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "요청을 확인해 주세요." };
  const requestId = v.requestId;
  // The same request again (e.g. the response was lost): it already went through, and the session is gone.
  const replay = sameRequest(requestId);
  if (replay) return replay;
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  // Another request while one is waiting (or after the 탈퇴): the account has no session any more.
  if (requestedOrWithdrawn()) return { status: "UNAUTHORIZED" };
  if (v.confirmed !== true) return { status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." };
  if (pendingRefunds() > 0) return { status: "REFUND_PENDING", count: pendingRefunds() };
  const questsEarly = questProblem(session);
  if (questsEarly) return questsEarly;
  // Pressing 탈퇴 re-checks this account's PENDING 플랫폼 후원 too, under the screen's rules (inside their 24 h, at most
  // once a minute each — 2026-10-09 결정): a result that has come in since the screen opened settles it, and the
  // withdrawal goes on in this request (a failure's returned FN is then checked against the consent like any amount).
  await recheckAccountPending();
  // A charge or an 출석 보상 on its way gets the same moment as on the screen (2026-10-10 결정): one that lands goes into
  // the balance, which the consent is then checked against like any amount.
  await settleInFlight();
  if (pendingPlatformDonations() > 0) return { status: "PLATFORM_PENDING", count: pendingPlatformDonations() };
  const creditsEarly = creditProblem();
  if (creditsEarly) return creditsEarly;
  const early = consentProblem(v, mockAccount.fnBalance, earningsOf(session));
  if (early) return early;
  await mockDelay(400);
  // The password shares the login's failure count (services/auth/loginLockCore.ts), like the 마이페이지 password
  // change: a session cannot be used to guess it here. At the login's limit the account locks and the session ends.
  const account = currentAccountKey();
  if (isPasswordLocked(account)) {
    await revokeSession();
    return { status: "LOCKED" };
  }
  if (typeof v.password !== "string" || v.password !== mockCredentials.password) {
    if (!recordPasswordFailure(account)) return { status: "WRONG_PASSWORD" };
    await revokeSession();
    return { status: "LOCKED" };
  }
  clearPasswordFailures(account);

  // From here on nothing awaits: the amounts are read again, compared with the consents and the request stored in one
  // step, so an admin decision or a donation during the password check cannot leave the consents out of date.
  if (requestedOrWithdrawn()) return sameRequest(requestId) ?? { status: "UNAUTHORIZED" };
  // A refund request made during the password check counts too, and so does a quest sent in the meantime.
  if (pendingRefunds() > 0) return { status: "REFUND_PENDING", count: pendingRefunds() };
  const quests = questProblem(session);
  if (quests) return quests;
  // A 플랫폼 후원 that went PENDING during the password check counts too.
  if (pendingPlatformDonations() > 0) return { status: "PLATFORM_PENDING", count: pendingPlatformDonations() };
  // So does a charge or an 출석 보상 started meanwhile (another tab), checked in the step that writes the withdrawal
  // (2026-10-10 결정): one that landed is in the balance compared below, and one started after this step finds the
  // account withdrawn and is refused (wallet/inFlightCore.ts `beginCredit`).
  const credits = creditProblem();
  if (credits) return credits;
  const balance = mockAccount.fnBalance;
  const earnings = earningsOf(session);
  const changed = consentProblem(v, balance, earnings);
  if (changed) return changed;

  // 회원탈퇴 유예 (2026-11-01 사용자 결정, FLEXTV 조건 기본안): nothing is forfeited or deleted now. The request is
  // stored with the amounts the member agreed to, and ./withdrawalApply.ts applies it exactly WITHDRAWAL_GRACE_DAYS
  // later; until then the account stays as it is, unusable, and signing in can cancel it (services/auth/login.ts).
  const requested = new Date();
  const effectiveAt = new Date(requested.getTime() + WITHDRAWAL_GRACE_DAYS * DAY_MS).toISOString();
  withdrawalStore().request = {
    requestId,
    requestedAt: requested.toISOString(),
    effectiveAt,
    consentedFn: balance,
    consentedEarningsFn: earnings,
    creator: hasRole(session, "CREATOR")
  };
  // Revoke instead of deleting the cookie, so the page keeps showing the 탈퇴 신청 접수 state. lib/session.ts also
  // refuses the account's session while the request waits, so a session in another tab ends too.
  await revokeSession();
  return { status: "REQUESTED", effectiveAt };
}
