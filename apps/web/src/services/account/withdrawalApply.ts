import { randomUUID } from "node:crypto";
import { bankSmsStore } from "@/services/bankSms/bankSmsCore";
import { clearChatFeed, managerLinks, onChannelChanged } from "@/services/broadcast/chatCore";
import { channelsStore } from "@/services/broadcast/channelsCore";
import { BROADCAST_PLATFORMS } from "@/services/platforms/adapters";
import { clearDonationImports } from "@/services/creator/donationImportCore";
import { mockCreator, newIntegrationKey } from "@/services/creator/mockCreatorStore";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { youtubeStore } from "@/services/creator/youtubeCore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { mockAccount } from "./mockStore";
import { isRequestDue, withdrawalStore } from "./withdrawalCore";
import { recordWithdrawal } from "./withdrawalRecord";

/**
 * 회원탈퇴 유예 (탈퇴 철회) — 2026-11-01 사용자 결정 (FLEXTV 조건 기본안): a 탈퇴 신청 (./withdrawal.ts) takes effect
 * 30 days after it, here. Server-only, not a "use server" module: the retention purge (./retentionPurge.ts — which the
 * admin console's reads and a 재가입 run first), the login mock and the sign-up actions call `applyDueWithdrawal` before
 * they read the account, so nothing sees a due request as an account; the backend runs it as a scheduled job.
 * `isWithdrawn()` (./withdrawalCore.ts) already counts a due request before this has run.
 *
 * What it does is what the 탈퇴 itself did before 2026-11-01 (2026-10-04 · 2026-10-05 · 2026-10-08 결정), at the request's
 * `effectiveAt`: the FN balance and (creators) 정산 대기 수익 are forfeited as they are at that moment — the member
 * agreed to it at the request, and only an operator's decision on something that existed before it (e.g. a 심사 대기
 * 정산 approved or rejected) can have changed them since — and the record keeps the actual amounts next to the
 * consented ones. Retention
 * (./retentionPolicy.ts — 기본값, 플렉스티비 기준, 법무 검토 전) counts from `effectiveAt` (the record's `at`).
 */

/**
 * Creator earnings a 탈퇴 forfeits: 정산 가능 FN + 심사 대기 requests. Approved requests are not part of it — they are
 * still paid after the 탈퇴 (2026-10-08 결정).
 */
export const unsettledFn = () => mockSettlement.availableFn + mockSettlement.requests.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amountFn, 0);

/**
 * Applies the slot account's 탈퇴 신청 when it is due at `now`: true when it did. Idempotent (the request is cleared in
 * the same step, and a later call finds none). Synchronous, so the amounts are read, recorded and forfeited in one step.
 */
export function applyDueWithdrawal(now: Date = new Date()): boolean {
  const store = withdrawalStore();
  const request = store.request;
  if (!request || !isRequestDue(request, now.getTime())) return false;
  store.request = null;
  // Defensive: one account withdraws once (a request is never stored next to a record).
  if (store.withdrawal) return false;
  const at = request.effectiveAt;
  // 탈퇴 신청 · 철회 이력: the account's cancelled requests go into the record with it (계약 기록).
  const cancelled = store.cancelled;
  store.cancelled = [];
  const balance = mockAccount.fnBalance;
  const earnings = request.creator ? unsettledFn() : 0;
  // The record keeps the consents (약관 동의 기록) and takes the 본인 확인 값 out of the credentials (the phone itself
  // goes, a keyed hash stays — 탈퇴 후 6개월, retentionPolicy.ts).
  recordWithdrawal({
    at,
    requestedAt: request.requestedAt,
    requestId: request.requestId,
    forfeitedFn: balance,
    forfeitedEarningsFn: earnings,
    consented: { fn: request.consentedFn, earningsFn: request.consentedEarningsFn },
    cancelled,
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
      Object.assign(r, { status: "FORFEITED", feeFn: 0, netKrw: 0, payoutDate: null, review: { at, by: "회원 탈퇴", note: "정산 대기 수익 소멸 (회원 동의)" } });
    }
  }
  // The payout account is this member's personal data, and a 재가입 must not find it registered (the 정산 이용 동의
  // stays in the withdrawal record, and each request keeps its own masked copy as a 정산 기록).
  Object.assign(mockSettlement, { terms: null, registration: null, autoSettlement: false });
  // Access that acts for the channel without a login ends with the account: manager links, platform chat
  // connections, the YouTube link, and the overlay / bank-SMS keys (reissued, so old URLs stop for good). During the
  // 30 days they were only closed (account/creatorAccess.ts), so a cancelled request opens them again unchanged.
  managerLinks().length = 0;
  channelsStore().channels = {};
  Object.assign(youtubeStore(), { channel: null, connectedAt: null, lastSyncedAt: null, lastError: null, videos: {} });
  // Chat / 후원 연동 cursors and switches belonged to those channels, and the chat feed holds viewers' messages.
  for (const p of BROADCAST_PLATFORMS) onChannelChanged(p);
  clearChatFeed();
  Object.assign(bankSmsStore(), { enabled: false, key: randomUUID() });
  mockCreator.integrationKey = newIntegrationKey();
  // 내역 이관: donations imported from 투네이션 / FlexTV hold other people's nicknames and messages; they go with the
  // account, with the batches, files waiting in a preview and the FlexTV read position.
  clearDonationImports();
  return true;
}
