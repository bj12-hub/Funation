import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";

/**
 * FN credits still on their way (2026-10-10 결정) — server-only, not a "use server" module (the charge and attendance
 * actions write it, 회원 탈퇴 reads it). A charge waiting for the payment provider (`requestCharge`) and an 출석 보상
 * waiting to be paid (`checkIn` · `claimAttendanceReward`) are registered here, with the account they are for, from the
 * step before their await to the step that credits them. 회원 탈퇴 is refused while the account has one
 * (services/account/withdrawal.ts), and the credit lands only while that account still holds the slot, active
 * (`landsHere`): never on a withdrawn account, nor on a 재가입 account that took the slot since.
 */

export type InFlightKind = "CHARGE" | "ATTENDANCE";

type Entry = { kind: InFlightKind; account: string | null; startedAt: string; done: Promise<void> };
type Store = { entries: Entry[] };

// V1: credits on their way, with the account they are for.
const g = globalThis as typeof globalThis & { __ssumnationMockInFlightV1?: Store };
const store = (): Store => (g.__ssumnationMockInFlightV1 ??= { entries: [] });

/**
 * How long opening the 회원 탈퇴 screen or pressing 탈퇴 waits for this account's credits on their way to land, so both
 * show the state after them (sample value — the payment provider's own time limit is TBD).
 */
export const IN_FLIGHT_WAIT_MS = 3_000;

export type InFlight = {
  /** The start marker (`accountSince()`) of the account the credit is for. */
  account: string | null;
  /** Whether that account still holds the slot and has not withdrawn — read in the step that credits. */
  landsHere: () => boolean;
  /** Ends the registration; call it in the same synchronous step as the credit (or the decision not to credit). */
  end: () => void;
};

/**
 * Registers a credit for the account holding the slot, or answers null when that account has withdrawn (its session
 * was read before the withdrawal went through). Call it after the action's last await before the one it registers,
 * in the same synchronous step as the action's own checks.
 */
export function beginCredit(kind: InFlightKind): InFlight | null {
  if (isWithdrawn()) return null;
  const s = store();
  let resolve: () => void = () => {};
  const entry: Entry = { kind, account: accountSince(), startedAt: new Date().toISOString(), done: new Promise<void>((r) => (resolve = r)) };
  s.entries.push(entry);
  return {
    account: entry.account,
    landsHere: () => entry.account === accountSince() && !isWithdrawn(),
    end: () => {
      const i = s.entries.indexOf(entry);
      if (i >= 0) s.entries.splice(i, 1);
      resolve();
    }
  };
}

/** Credits of this kind still on their way to the account with this start marker (default: the slot's account now). */
export const inFlightCount = (kind: InFlightKind, account: string | null = accountSince()) =>
  store().entries.filter((e) => e.kind === kind && e.account === account).length;

/**
 * Waits until every credit on its way to the slot's account now has landed (or failed), at most `maxMs`. Those that
 * have not by then still count (`inFlightCount`), and 회원 탈퇴 is refused for them.
 */
export async function settleInFlight(maxMs = IN_FLIGHT_WAIT_MS): Promise<void> {
  const account = accountSince();
  const waiting = store()
    .entries.filter((e) => e.account === account)
    .map((e) => e.done);
  if (waiting.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.all(waiting), new Promise<void>((resolve) => (timer = setTimeout(resolve, maxMs)))]);
  } finally {
    clearTimeout(timer);
  }
}
