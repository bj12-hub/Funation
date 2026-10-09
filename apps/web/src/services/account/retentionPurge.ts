import { SAMPLE_MEMBER_ID, withdrawnMemberId } from "@/services/admin/memberCore";
import { WITHDRAWN_MEMBER_NAME } from "@/services/admin/paymentTypes";
import { accountKeyOf, forgetAccess } from "@/services/auth/loginLockCore";
import { mockCommunity } from "@/services/community/mockCommunityStore";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { channelCommunityStore } from "@/services/creators/channelCommunityCore";
import { moderationStore } from "@/services/moderation/moderationCore";
import { forgetInquiries, inquiryAccountKey } from "@/services/support/inquiryCore";
import { mockCredits } from "@/services/wallet/mockCreditStore";
import { mockFnSettlements } from "@/services/wallet/mockFnSettlementStore";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { isRetentionExpired, retentionSchedule, type RetentionCategory } from "./retentionPolicy";
import { accountAt, withdrawnAccounts, type Withdrawal } from "./withdrawalCore";

/**
 * Mock retention purge (./retentionPolicy.ts, 기본값 — 법무 검토 전): once a category's date has come, the withdrawn
 * account's data of that category is removed or anonymised in the mock stores, once. It runs lazily — when the admin
 * console reads (members, payments, settlements, dashboard) and at sign-up, before a 재가입 looks for the person key —
 * so a page never shows data past its date. The backend runs the same rules as a scheduled job over every table.
 *
 * Posts are never purged: they stay up under "탈퇴한 회원" (2026-10-08 결정); once the 탈퇴 기록 goes, so does the
 * original nickname stored on them. Server-only.
 */

type Target = { record: Withdrawal; account: string | null; memberId: string };

/** Object keys starting with `prefix` removed (request ids of a member). */
const dropKeys = (map: Record<string, string>, prefix: string) => {
  for (const k of Object.keys(map)) if (k.startsWith(prefix)) delete map[k];
};

const PURGE: Record<Exclude<RetentionCategory, "POSTS">, (t: Target) => void> = {
  /** 접속 기록: login records, failures and locks of the account. */
  ACCESS_LOG: (t) => forgetAccess(accountKeyOf(t.account)),

  /** 본인 확인 값: the person key and phone hash go; a later sign-up with the same phone is a new person. */
  PERSON_KEY: (t) => {
    t.record.person = null;
  },

  /** 분쟁 처리 기록: the account's 1:1 문의, and its name and words on the reports it filed (the decisions stay). */
  DISPUTE: (t) => {
    forgetInquiries(inquiryAccountKey(SAMPLE_MEMBER_ID, t.account));
    const moderation = moderationStore();
    for (const r of moderation.reports) if (r.reporterId === t.memberId) Object.assign(r, { reporterName: WITHDRAWN_MEMBER_NAME, detail: "" });
    dropKeys(moderation.requests, `${t.memberId}|`);
  },

  /** 대금결제 기록: the account's charges, donations, credits, refund requests, 남은 FN 정리 and settlement requests. */
  PAYMENT: (t) => {
    const own = (stamp: string) => accountAt(stamp) === t.account;
    mockWallet.charges = mockWallet.charges.filter((c) => !own(c.chargedAt));
    mockWallet.donations = mockWallet.donations.filter((d) => !own(d.donatedAt));
    mockCredits.credits = mockCredits.credits.filter((c) => c.account !== t.account);
    mockRefunds.requests = mockRefunds.requests.filter((r) => r.accountSince !== t.account);
    mockFnSettlements.settlements = mockFnSettlements.settlements.filter((s) => s.accountSince !== t.account);
    mockSettlement.requests = mockSettlement.requests.filter((r) => (r.account ?? null) !== t.account);
    if (mockSettlement.pastRequests) mockSettlement.pastRequests = mockSettlement.pastRequests.filter((r) => (r.account ?? null) !== t.account);
    // The first account's sample (seed) history is generated: walletHistory.ts leaves it out once this is recorded.
  },

  /**
   * 계약 기록: the withdrawal record keeps only when it happened (the admin directory no longer lists the account), and
   * the nickname stored with its kept posts, comments, channel posts, block entries and the reports about them goes.
   */
  CONTRACT: (t) => {
    Object.assign(t.record, { requestId: "", forfeitedFn: 0, forfeitedEarningsFn: 0, nickname: WITHDRAWN_MEMBER_NAME, ssumnationId: "", consents: null });
    for (const p of mockCommunity.posts) {
      if (p.authorId === t.memberId) p.authorName = WITHDRAWN_MEMBER_NAME;
      for (const c of p.comments) if (c.authorId === t.memberId) c.authorName = WITHDRAWN_MEMBER_NAME;
    }
    for (const p of channelCommunityStore().posts) if (p.authorId === t.memberId) p.authorName = WITHDRAWN_MEMBER_NAME;
    const moderation = moderationStore();
    for (const r of moderation.reports) if (r.authorId === t.memberId) r.authorName = WITHDRAWN_MEMBER_NAME;
    for (const blocks of Object.values(moderation.blocks)) {
      const entry = blocks[t.memberId];
      if (entry) entry.name = WITHDRAWN_MEMBER_NAME;
    }
  }
};

/**
 * Removes or anonymises every withdrawn account's data whose retention date is at or before `now`. Idempotent: each
 * category of an account is purged once (`Withdrawal.purged`).
 */
export function purgeExpired(now: Date = new Date()) {
  for (const a of withdrawnAccounts()) {
    const target: Target = { record: a.record, account: a.account, memberId: a.n === null ? SAMPLE_MEMBER_ID : withdrawnMemberId(a.n) };
    for (const due of retentionSchedule(a.record.at)) {
      if (due.category === "POSTS" || a.record.purged.includes(due.category) || !isRetentionExpired(due.until, now)) continue;
      PURGE[due.category](target);
      a.record.purged.push(due.category);
    }
  }
}
