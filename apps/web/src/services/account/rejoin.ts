import { toDateString } from "@/lib/period";
import { SAMPLE_MEMBER_ID, withdrawnMemberId } from "@/services/admin/memberCore";
import { mockCommunity } from "@/services/community/mockCommunityStore";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { channelCommunityStore } from "@/services/creators/channelCommunityCore";
import { mockMessages } from "@/services/messages/mockMessageStore";
import { moderationStore } from "@/services/moderation/moderationCore";
import { notificationStore } from "@/services/notifications/notificationCore";
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
 * 1:1 문의 list, its own row in the channel 월간 후원 랭킹 and its own 내 룰렛 · 내 뽑기 in the room, and a
 * fresh login failure count; the phone verified at sign-up becomes its phone (today's check-in and the 룰렛 · 뽑기
 * daily limits count once per person, 2026-10-08 결정). The withdrawn account's posts, comments, blocks and reports stay with its own member id
 * (`retireSlotMember`), and its notifications are not the new account's. The withdrawal record stays for audit. Mock
 * limitation: the 썸네이션 ID and other per-account sample data (favorites, messages …) are shared with the old slot.
 */
export function startNewAccount(input: { nickname: string; password: string; marketing: boolean; phone: string }, now = new Date()) {
  const store = withdrawalStore();
  if (!store.withdrawal) return false;
  // The withdrawn account keeps its start marker: the admin console finds its wallet records with it.
  store.past.push({ ...store.withdrawal, accountSince: store.accountSince });
  store.withdrawal = null;
  retireSlotMember(withdrawnMemberId(store.past.length));
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

/** The map with keys starting with `from` moved to start with `to` (other members' keys untouched). */
const rekey = <T>(map: Record<string, T>, from: string, to: string): Record<string, T> =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [k.startsWith(from) ? `${to}${k.slice(from.length)}` : k, v]));

/**
 * The slot's member id now belongs to the new account, so what the withdrawn account wrote and set moves to its own
 * id `to` (the admin directory's `…-wN`). Its community posts, comments and channel posts stay up under "탈퇴한 회원"
 * (2026-10-08 결정, admin/memberCore `shownMemberName`) but are no longer the slot's to edit or delete; its block list, the blocks others
 * set on it, its reports (as author and as reporter, so 신고 처리 links the right member) and its request ids go with it.
 * Its notifications were about its own charges, donations and refunds, which the new account does not have.
 */
function retireSlotMember(to: string) {
  const from = SAMPLE_MEMBER_ID;
  for (const p of mockCommunity.posts) {
    if (p.authorId === from) p.authorId = to;
    for (const c of p.comments) if (c.authorId === from) c.authorId = to;
  }
  mockCommunity.postRequests = rekey(mockCommunity.postRequests, `${from}:`, `${to}:`);
  mockCommunity.commentRequests = rekey(mockCommunity.commentRequests, `${from}:`, `${to}:`);
  mockMessages.requests = rekey(mockMessages.requests, `${from}:`, `${to}:`);
  const channel = channelCommunityStore();
  for (const p of channel.posts) if (p.authorId === from) p.authorId = to;
  channel.requests = rekey(channel.requests, `${from}:`, `${to}:`);
  const moderation = moderationStore();
  for (const r of moderation.reports) {
    if (r.authorId === from) r.authorId = to;
    if (r.reporterId === from) r.reporterId = to;
  }
  moderation.requests = rekey(moderation.requests, `${from}|`, `${to}|`);
  for (const blocks of Object.values(moderation.blocks)) {
    const entry = blocks[from];
    if (!entry) continue;
    delete blocks[from];
    blocks[to] = { ...entry, authorId: to };
  }
  const own = moderation.blocks[from];
  if (own) {
    moderation.blocks[to] = own;
    delete moderation.blocks[from];
  }
  notificationStore().items.length = 0;
}
