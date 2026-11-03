import type { RetentionCategory } from "./retentionPolicy";

/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의,
 * 비밀번호 재입력, 바로 재가입 가능) — server-only state, not a "use server" module, so the session, the login
 * mock, the wallet history and the admin member directory can read it without import cycles.
 * The mock has one account slot (the sample member). A withdrawn account cannot sign in; its record (who,
 * when, what was forfeited, its consents and its 본인 확인 값) stays for audit, also after the same person signs up
 * again as a new account — each part until its date in ./retentionPolicy.ts (기본값, 법무 검토 전), when
 * ./retentionPurge.ts removes or anonymises it.
 *
 * 회원탈퇴 유예 (탈퇴 철회) — 2026-11-01 사용자 결정 (FLEXTV 조건 기본안): pressing 탈퇴 stores a request
 * (`WithdrawalRequest`) that takes effect WITHDRAWAL_GRACE_DAYS (30) days later. During those days (기본값) the account
 * and all its data stay as they are but cannot be used — no session, creator access closed, a waiting debit refused —
 * and signing in with the password offers to cancel it (services/auth/login.ts), which restores the account exactly as
 * it was. On the day it is due, ./withdrawalApply.ts applies it lazily (`applyDueWithdrawal`); until that has run,
 * `isWithdrawn()` already counts a due request, so every check treats the account as withdrawn from `effectiveAt` on.
 *
 * 탈퇴 신청 · 철회 이력 — 2026-11-02 사용자 결정: a cancelled request is kept (`CancelledWithdrawalRequest`) and the
 * admin console's 회원 상세 lists every request of the account with how it ended. They are 계약 · 청약철회 기록, kept like
 * the withdrawal record (5년 — ./retentionPolicy.ts, 기본값): a cancelled one for 5 years from its 철회, and the one that
 * took effect with the record, 5 years from the 탈퇴 (./retentionPurge.ts). A withdrawal takes the account's cancelled
 * ones into its record.
 */

/**
 * 탈퇴 신청 waiting for its date. `consentedFn` / `consentedEarningsFn`: the amounts the member saw and agreed to
 * forfeit when it was made (the apply forfeits what remains at `effectiveAt`). `creator`: the account had the Creator
 * role when it asked, so its 정산 대기 수익 are forfeited too.
 */
export type WithdrawalRequest = {
  requestId: string;
  requestedAt: string;
  /** `requestedAt` + WITHDRAWAL_GRACE_DAYS days, exactly. */
  effectiveAt: string;
  consentedFn: number;
  consentedEarningsFn: number;
  creator: boolean;
};

/** A 탈퇴 신청 the member cancelled by signing in (탈퇴 철회) at `cancelledAt` (ISO), with what it held. */
export type CancelledWithdrawalRequest = WithdrawalRequest & { cancelledAt: string };

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
  /** When the withdrawal took effect (a request's `effectiveAt`); retention periods count from it. */
  at: string;
  /** When the member asked for it (탈퇴 신청); null for a record written without a request. */
  requestedAt: string | null;
  requestId: string;
  /** FN balance forfeited when it took effect (the member agreed, at the request, to forfeit what remains then). */
  forfeitedFn: number;
  /** Creator earnings waiting for settlement (정산 가능 + 정산 신청 중) forfeited when it took effect, likewise. */
  forfeitedEarningsFn: number;
  /**
   * The amounts the member saw and agreed to forfeit at the 탈퇴 신청 (its consents), kept for audit next to what was
   * forfeited 30 days later; null for a record written without a request.
   */
  consented: { fn: number; earningsFn: number } | null;
  /** The account's 탈퇴 신청 cancelled before this one, oldest first; each goes 5 years after its 철회 (계약 기록). */
  cancelled: CancelledWithdrawalRequest[];
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
  /** The slot account's 탈퇴 신청 until it is applied (then `withdrawal`) or cancelled at sign-in. */
  request: WithdrawalRequest | null;
  /** The slot account's cancelled 탈퇴 신청, oldest first, until its withdrawal takes them into its record. */
  cancelled: CancelledWithdrawalRequest[];
  /** Earlier withdrawals of the slot, before a 재가입 started a new account. Never removed (`…-wN` is the index). */
  past: PastAccount[];
  /** Local "YYYY-MM-DD HH:MM:SS" when the current account started (재가입); earlier wallet records are not its own. */
  accountSince: string | null;
  /** The mock's secret for phone hashes (the backend keeps one outside the database). */
  phoneHashKey: string;
};
// V6: cancelled 탈퇴 신청 (V5: the 탈퇴 신청 waiting for its date, records keep when it was asked; V4: consents, 본인 확인
// 값, purged categories; V3: past accounts keep their start marker).
const g = globalThis as typeof globalThis & { __ssumnationMockWithdrawalV6?: Store };
export const withdrawalStore = (): Store =>
  (g.__ssumnationMockWithdrawalV6 ??= { withdrawal: null, request: null, cancelled: [], past: [], accountSince: null, phoneHashKey: "" });

/** True from the request's `effectiveAt` on. */
export const isRequestDue = (request: WithdrawalRequest, now = Date.now()) => Date.parse(request.effectiveAt) <= now;

/** The sample account's withdrawal record, or null while it is active (or its request has not been applied yet). */
export const withdrawalOf = () => withdrawalStore().withdrawal;
/** The slot account's 탈퇴 신청 while it is not due yet (the 30 days are running), else null. */
export const withdrawalRequestOf = (): WithdrawalRequest | null => {
  const request = withdrawalStore().request;
  return request && !isRequestDue(request) ? request : null;
};
/** True during the 30 days of a 탈퇴 신청: the account exists, unchanged, but cannot be used until it is cancelled. */
export const isWithdrawalRequested = () => withdrawalRequestOf() !== null;

/**
 * 탈퇴 철회: the slot account's waiting 탈퇴 신청 ends, kept as cancelled at `now` (탈퇴 신청 · 철회 이력). False when
 * there is none to cancel (none, or already due).
 */
export function cancelWithdrawalRequest(now: Date = new Date()): boolean {
  const store = withdrawalStore();
  const request = store.request;
  if (!request || isRequestDue(request, now.getTime())) return false;
  store.request = null;
  store.cancelled.push({ ...request, cancelledAt: now.toISOString() });
  return true;
}
/**
 * True once the slot account has withdrawn: its record exists, or its 탈퇴 신청 is due (from `effectiveAt` on, also
 * before ./withdrawalApply.ts has applied it).
 */
export const isWithdrawn = () => {
  const { withdrawal, request } = withdrawalStore();
  return withdrawal !== null || (request !== null && isRequestDue(request));
};
export const accountSince = () => withdrawalStore().accountSince;

/**
 * The account a request acts for: the slot's account when its session was read (call it right after `getSession`).
 * `stillHere` answers whether that account still holds the slot, active — a request that awaits before it debits FN
 * (후원, 플랫폼 후원) checks it in the step that debits, so FN of the account that took the slot since (탈퇴, then 재가입)
 * are never spent for it. The debit-side counterpart of the credit check (wallet/inFlightCore.ts `landsHere`). A 탈퇴
 * 신청 made meanwhile (another tab) counts too: the account cannot be used during its 30 days.
 */
export function sessionAccount(): { account: string | null; stillHere: () => boolean } {
  const account = accountSince();
  return { account, stillHere: () => !isWithdrawn() && !isWithdrawalRequested() && accountSince() === account };
}

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

// recordWithdrawal and personKeyFor live in ./withdrawalRecord.ts and applyDueWithdrawal in ./withdrawalApply.ts
// (server-only: node:crypto and the stores a withdrawal clears). This module stays free of Node built-ins and server
// imports because shared helpers (admin/memberCore → creators) are also bundled for the browser.
