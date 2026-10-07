/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의,
 * 비밀번호 재입력, 바로 재가입 가능) — server-only state, not a "use server" module, so the session, the login
 * mock, the wallet history and the admin member directory can read it without import cycles.
 * The mock has one account slot (the sample member). A withdrawn account cannot sign in; its record (who,
 * when, what was forfeited) stays for audit, also after the same person signs up again as a new account.
 * How long records are kept is TBD.
 */

export type Withdrawal = {
  at: string;
  requestId: string;
  /** FN balance the member agreed to forfeit. */
  forfeitedFn: number;
  /** Creator earnings waiting for settlement (정산 가능 + 정산 신청 중) the member agreed to forfeit. */
  forfeitedEarningsFn: number;
  /** Who withdrew (the admin directory keeps listing them as 탈퇴). */
  nickname: string;
  funationId: string;
};

/** A withdrawn account a 재가입 moved aside, with the start marker it had while it held the slot (null = the first). */
export type PastAccount = Withdrawal & { accountSince: string | null };

type Store = {
  withdrawal: Withdrawal | null;
  /** Earlier withdrawals of the slot, before a 재가입 started a new account. */
  past: PastAccount[];
  /** Local "YYYY-MM-DD HH:MM:SS" when the current account started (재가입); earlier wallet records are not its own. */
  accountSince: string | null;
};
// V3: past accounts keep their start marker, so the admin console can attribute their wallet records to them.
const g = globalThis as typeof globalThis & { __funationMockWithdrawalV3?: Store };
export const withdrawalStore = (): Store => (g.__funationMockWithdrawalV3 ??= { withdrawal: null, past: [], accountSince: null });

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
