import type { RetentionCategory } from "./retentionPolicy";

/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의,
 * 비밀번호 재입력, 바로 재가입 가능) — server-only state, not a "use server" module, so the session, the login
 * mock, the wallet history and the admin member directory can read it without import cycles.
 * The mock has one account slot (the sample member). A withdrawn account cannot sign in; its record (who,
 * when, what was forfeited, its consents and its 본인 확인 값) stays for audit, also after the same person signs up
 * again as a new account — each part until its date in ./retentionPolicy.ts (기본값, 법무 검토 전), when
 * ./retentionPurge.ts removes or anonymises it.
 */

/** 약관 동의 기록 kept with the withdrawal (계약 · 청약철회 기록): when the account agreed, or null when it never did. */
export type WithdrawalConsents = {
  /** FN 충전 이용약관. */
  chargeTerms: string | null;
  /** 정산 이용 동의 (creators). */
  settlementTerms: string | null;
};

/**
 * 부정 이용 방지용 본인 확인 값: the account's person key and a keyed hash of the phone verified at sign-up (the phone
 * itself is gone). A 재가입 with the same phone takes the key over while it is kept.
 */
export type PersonCheck = { key: string; phoneHash: string };

export type Withdrawal = {
  at: string;
  requestId: string;
  /** FN balance the member agreed to forfeit. */
  forfeitedFn: number;
  /** Creator earnings waiting for settlement (정산 가능 + 정산 신청 중) the member agreed to forfeit. */
  forfeitedEarningsFn: number;
  /** Who withdrew (the admin directory keeps listing them as 탈퇴). */
  nickname: string;
  ssumnationId: string;
  /** null once the 계약 기록 is purged. */
  consents: WithdrawalConsents | null;
  /** null once dropped, a year after the withdrawal. */
  person: PersonCheck | null;
  /** Retention categories already purged from this account's data, in the order they went. */
  purged: RetentionCategory[];
};

/** A withdrawn account a 재가입 moved aside, with the start marker it had while it held the slot (null = the first). */
export type PastAccount = Withdrawal & { accountSince: string | null };

type Store = {
  withdrawal: Withdrawal | null;
  /** Earlier withdrawals of the slot, before a 재가입 started a new account. Never removed (`…-wN` is the index). */
  past: PastAccount[];
  /** Local "YYYY-MM-DD HH:MM:SS" when the current account started (재가입); earlier wallet records are not its own. */
  accountSince: string | null;
  /** The mock's secret for phone hashes (the backend keeps one outside the database). */
  phoneHashKey: string;
};
// V4: records keep their consents, the 본인 확인 값 and what was purged (V3: past accounts keep their start marker).
const g = globalThis as typeof globalThis & { __ssumnationMockWithdrawalV4?: Store };
export const withdrawalStore = (): Store =>
  (g.__ssumnationMockWithdrawalV4 ??= { withdrawal: null, past: [], accountSince: null, phoneHashKey: "" });

/** The sample account's withdrawal, or null while it is active. */
export const withdrawalOf = () => withdrawalStore().withdrawal;
export const isWithdrawn = () => withdrawalOf() !== null;
export const accountSince = () => withdrawalStore().accountSince;

/**
 * The start marker of the slot account a wallet record stamped `stamp` (local "YYYY-MM-DD HH:MM:SS") belongs to: the
 * latest account that had started by then. Like the members' own history (`stamp >= accountSince()`), so the console
 * and the member agree on whose record it is.
 */
export const accountAt = (stamp: string) =>
  [...withdrawalStore().past.map((p) => p.accountSince), accountSince()].reduce<string | null>((owner, m) => (m === null || m <= stamp ? m : owner), null);

/**
 * Every withdrawn account of the slot with its start marker: the earlier ones (`n` = 1, 2 … as in `…-wN`), then the
 * slot's own while it is withdrawn (`n` = null).
 */
export function withdrawnAccounts(): { record: Withdrawal; account: string | null; n: number | null }[] {
  const store = withdrawalStore();
  const past = store.past.map((p, i) => ({ record: p as Withdrawal, account: p.accountSince, n: i + 1 }));
  return store.withdrawal ? [...past, { record: store.withdrawal, account: store.accountSince, n: null }] : past;
}

/** True once a category of the withdrawn account with this start marker was purged (e.g. its seed wallet rows). */
export const isPurged = (account: string | null, category: RetentionCategory) =>
  withdrawnAccounts().some((a) => a.account === account && a.record.purged.includes(category));

// recordWithdrawal and personKeyFor live in ./withdrawalRecord.ts (server-only: node:crypto). This module stays
// free of Node built-ins because shared helpers (admin/memberCore → creators) are also bundled for the browser.
