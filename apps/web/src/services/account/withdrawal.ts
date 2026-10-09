"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { clearPasswordFailures, currentAccountKey, isPasswordLocked, recordPasswordFailure } from "@/services/auth/loginLockCore";
import { getSession, hasRole, revokeSession, type Session } from "@/lib/session";
import { bankSmsStore } from "@/services/bankSms/bankSmsCore";
import { clearChatFeed, managerLinks, onChannelChanged } from "@/services/broadcast/chatCore";
import { channelsStore } from "@/services/broadcast/channelsCore";
import { BROADCAST_PLATFORMS } from "@/services/platforms/adapters";
import { mockCreator, newIntegrationKey } from "@/services/creator/mockCreatorStore";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { youtubeStore } from "@/services/creator/youtubeCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { mockQuests } from "@/services/donations/questCore";
import { mockPlatform } from "@/services/platformDonation/mockPlatformStore";
import { awaitsResult, recheckAccountPending } from "@/services/platformDonation/pendingCore";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { mockAccount, mockCredentials } from "./mockStore";
import { accountSince, isWithdrawn, withdrawalOf } from "./withdrawalCore";
import { recordWithdrawal } from "./withdrawalRecord";
import type { PendingQuests, WithdrawResult, WithdrawalInfo } from "./withdrawalTypes";

/**
 * 회원 탈퇴 — code-first, route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05:
 * 크리에이터 정산 대기 수익도 소멸 동의, 탈퇴 직전 비밀번호 재입력). The server re-checks the session, every consent
 * and the password, forfeits exactly the amounts the member saw, and ends the session. One request id per intended
 * withdrawal, so a retry after a lost response gets the same answer. Rate limiting of password attempts belongs to
 * the backend; accounts that only use social login re-confirm with that login (provider hand-off TBD).
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
 * Retention (./retentionPolicy.ts — 기본값, 일반적인 기준, 법무 검토 전): the withdrawal record with the consents, the
 * payment, dispute and access records and the 본인 확인 값 stay until their dates (./retentionPurge.ts), posts stay up
 * under "탈퇴한 회원"; every other piece of personal data goes now.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Withdrawal API is not connected yet.");
};

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

/**
 * Creator earnings a 탈퇴 forfeits: 정산 가능 FN + 심사 대기 requests. Approved requests are not part of it — they are
 * still paid after the 탈퇴 (2026-10-08 결정).
 */
const unsettledFn = () => mockSettlement.availableFn + mockSettlement.requests.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amountFn, 0);

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

export async function getWithdrawalInfo(): Promise<WithdrawalInfo | null> {
  assertMock();
  const session = await getSession();
  if (!session) return null;
  // Opening the screen re-checks this account's PENDING 플랫폼 후원 as 후원 내역 does (inside their 24 h, at most once a
  // minute each): a result that has come in settles it, so it no longer blocks the withdrawal.
  await recheckAccountPending();
  await mockDelay(200);
  const creator = hasRole(session, "CREATOR");
  return {
    nickname: mockAccount.nickname,
    fnBalance: mockAccount.fnBalance,
    creator,
    unsettledFn: creator ? unsettledFn() : 0,
    pendingRefunds: pendingRefunds(),
    pendingQuests: pendingQuests(session),
    pendingPlatformDonations: pendingPlatformDonations()
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
  // The same request again (e.g. the response was lost): it already went through, and the session is gone.
  if (withdrawalOf()?.requestId === v.requestId) return { status: "WITHDRAWN" };
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (v.confirmed !== true) return { status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." };
  if (pendingRefunds() > 0) return { status: "REFUND_PENDING", count: pendingRefunds() };
  const questsEarly = questProblem(session);
  if (questsEarly) return questsEarly;
  // Pressing 탈퇴 re-checks this account's PENDING 플랫폼 후원 too, under the screen's rules (inside their 24 h, at most
  // once a minute each — 2026-10-09 결정): a result that has come in since the screen opened settles it, and the
  // withdrawal goes on in this request (a failure's returned FN is then checked against the consent like any amount).
  await recheckAccountPending();
  if (pendingPlatformDonations() > 0) return { status: "PLATFORM_PENDING", count: pendingPlatformDonations() };
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

  // From here on nothing awaits: the amounts are read again, compared with the consents and forfeited in one
  // step, so an admin decision or a donation during the password check cannot leave the record out of date.
  if (isWithdrawn()) return withdrawalOf()?.requestId === v.requestId ? { status: "WITHDRAWN" } : { status: "UNAUTHORIZED" };
  // A refund request made during the password check counts too, and so does a quest sent in the meantime.
  if (pendingRefunds() > 0) return { status: "REFUND_PENDING", count: pendingRefunds() };
  const quests = questProblem(session);
  if (quests) return quests;
  // A 플랫폼 후원 that went PENDING during the password check counts too.
  if (pendingPlatformDonations() > 0) return { status: "PLATFORM_PENDING", count: pendingPlatformDonations() };
  const balance = mockAccount.fnBalance;
  const earnings = earningsOf(session);
  const changed = consentProblem(v, balance, earnings);
  if (changed) return changed;

  const now = new Date().toISOString();
  // The record keeps the consents (약관 동의 기록) and takes the 본인 확인 값 out of the credentials (the phone itself
  // goes, a keyed hash stays a year).
  recordWithdrawal({
    at: now,
    requestId: v.requestId,
    forfeitedFn: balance,
    forfeitedEarningsFn: earnings,
    consents: { chargeTerms: mockWallet.chargeTermsAgreedAt, settlementTerms: mockSettlement.terms?.acceptedAt ?? null }
  });
  mockAccount.fnBalance = 0;
  // Personal data no retention rule keeps: profile image, 본인인증, marketing consent, login and platform links.
  Object.assign(mockAccount, { avatarUrl: null, identity: null, marketingConsent: false });
  mockWallet.marketingOptIn = false;
  mockAccount.linkedLoginProviders = { NAVER: null, GOOGLE: null, KAKAO: null };
  mockAccount.connectedPlatforms = mockAccount.connectedPlatforms.map((p) => ({ ...p, handle: null }));
  if (earnings > 0) {
    // 정산 가능 FN is gone, and requests still waiting for review end as 탈퇴 소멸 (not 반려 — nobody rejected them).
    mockSettlement.availableFn = 0;
    for (const r of mockSettlement.requests.filter((r) => r.status === "PENDING")) {
      Object.assign(r, { status: "FORFEITED", feeFn: 0, netKrw: 0, payoutDate: null, review: { at: now, by: "회원 탈퇴", note: "정산 대기 수익 소멸 (회원 동의)" } });
    }
  }
  // The payout account is this member's personal data, and a 재가입 must not find it registered (the 정산 이용 동의
  // stays in the withdrawal record, and each request keeps its own masked copy as a 정산 기록).
  Object.assign(mockSettlement, { terms: null, registration: null, autoSettlement: false });
  // Access that acts for the channel without a login ends with the account: manager links, platform chat
  // connections, the YouTube link, and the overlay / bank-SMS keys (reissued, so old URLs stop for good).
  managerLinks().length = 0;
  channelsStore().channels = {};
  Object.assign(youtubeStore(), { channel: null, connectedAt: null, lastSyncedAt: null, lastError: null, videos: {} });
  // Chat / 후원 연동 cursors and switches belonged to those channels, and the chat feed holds viewers' messages.
  for (const p of BROADCAST_PLATFORMS) onChannelChanged(p);
  clearChatFeed();
  Object.assign(bankSmsStore(), { enabled: false, key: randomUUID() });
  mockCreator.integrationKey = newIntegrationKey();
  // Revoke instead of deleting the cookie, so the page keeps showing the 탈퇴 완료 state.
  await revokeSession();
  return { status: "WITHDRAWN" };
}
