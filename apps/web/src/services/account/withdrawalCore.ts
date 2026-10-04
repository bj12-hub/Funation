/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴) — server-only state, not a "use server" module,
 * so the session, the login mock and the admin member directory can read it without import cycles.
 * The mock has one account (the sample member). A withdrawn account cannot sign in; the record (when,
 * how much FN was forfeited) stays for audit. Rejoining and how long records are kept are TBD.
 */

export type Withdrawal = { at: string; requestId: string; forfeitedFn: number };

type Store = { withdrawal: Withdrawal | null };
const g = globalThis as typeof globalThis & { __funationMockWithdrawalV1?: Store };
export const withdrawalStore = (): Store => (g.__funationMockWithdrawalV1 ??= { withdrawal: null });

/** The sample account's withdrawal, or null while it is active. */
export const withdrawalOf = () => withdrawalStore().withdrawal;
export const isWithdrawn = () => withdrawalOf() !== null;
