import { toDateString } from "@/lib/period";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { resetMockIdentity } from "@/services/supporter/mockIdentityStore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { mockAccount, mockChangeHistory, mockCredentials, mockSessionState } from "./mockStore";
import { withdrawalStore } from "./withdrawalCore";

/**
 * 재가입 (2026-10-05 결정: 탈퇴 후 바로 재가입 가능) — server-only, called by the sign-up mock. The mock has one
 * account slot, so a sign-up after a withdrawal starts a new account in it: new nickname and password, no FN,
 * no links, supporter role only, an empty wallet history (earlier charges and donations belong to the
 * withdrawn account and are not restored), no consent to the FN charge terms (the new member agrees again) and
 * no settlement history or earnings (the withdrawn account's requests stay with the admin console only), and no
 * 별명, 대표 별명 or 칭호 표시 설정 (a title the old account picked must not show on the new one's alerts). The new
 * start marker (`accountSince`) also gives it its own 출석 month and reward credits (services/attendance), its own
 * 1:1 문의 list and its own row in the channel 월간 후원 랭킹, and a
 * fresh login failure count; the phone verified at sign-up becomes its phone (today's check-in counts once per
 * person, 2026-10-08 결정). The withdrawal record stays for audit. Mock limitation: the
 * 썸네이션 ID and other per-account sample data (favorites, messages …) are shared with the old slot.
 */
export function startNewAccount(input: { nickname: string; password: string; marketing: boolean; phone: string }, now = new Date()) {
  const store = withdrawalStore();
  if (!store.withdrawal) return false;
  store.past.push(store.withdrawal);
  store.withdrawal = null;
  store.accountSince = `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`;
  Object.assign(mockAccount, {
    nickname: input.nickname,
    avatarUrl: null,
    identity: null,
    fnBalance: 0,
    rankingVisibility: { quest: true },
    marketingConsent: input.marketing
  });
  Object.assign(mockCredentials, { password: input.password, recentPasswords: [input.password], changedAt: now.toISOString(), phone: input.phone });
  Object.assign(mockChangeHistory, { nicknameChangedAt: null, funationIdChangedAt: null });
  Object.assign(mockWallet, { chargeTermsAgreedAt: null, marketingOptIn: false });
  (mockSettlement.pastRequests ??= []).push(...mockSettlement.requests);
  Object.assign(mockSettlement, { requests: [], idempotency: {}, availableFn: 0 });
  resetMockIdentity();
  mockSessionState.roles = ["SUPPORTER"];
  return true;
}
