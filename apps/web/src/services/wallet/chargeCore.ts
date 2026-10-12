import { toDateString } from "@/lib/period";
import { mockAccount } from "@/services/account/mockStore";
import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";
import { notify } from "@/services/notifications/notificationCore";
import { inFlightCount } from "./inFlightCore";
import { mockWallet, type UncreditedCharge } from "./mockWalletStore";
import { findChargeRecord, listChargeRecords } from "./walletHistory";

/**
 * FN 충전 in progress and late results (2026-10-10 결정) — server-only, not a "use server" module (the charge action,
 * 회원 탈퇴 and the console share it).
 *
 * - In progress: a charge whose payment provider call is still running (./inFlightCore.ts, `requestCharge`), and a charge
 *   whose status is still 처리중 (PROCESSING), waiting for its payment to be confirmed. 회원 탈퇴 is refused while the
 *   account has either (`pendingCharges`), until it completes or fails.
 * - Its FN land only on the account that made it, while that account still holds the slot, active. A payment that
 *   completes after that account withdrew is never credited — not to the withdrawn account, not to a 재가입 account — and
 *   is kept for the console's 결제 · 환불, which shows it as 완료 · FN 미지급 (탈퇴) (`isUncredited`). What happens to the
 *   KRW paid (PG 취소 · 환불) is TBD.
 * - The mock has no payment provider webhook or status lookup (TBD): `requestCharge` answers 완료 or 실패 by itself, so
 *   the only 처리중 charges are the sample's (ch1). An operator decides them in the console's 처리 중 충전 (2026-10-12
 *   결정, admin/pendingCharges.ts) — 결제 확인 or 결제 취소, through `confirmChargePayment` — and tests do it directly
 *   (test/mockEnv.ts `settleSampleCharges`).
 */

const localStamp = (d: Date) => `${toDateString(d)} ${d.toTimeString().slice(0, 8)}`;

/** The account's charges in progress: provider calls still running + 처리중 charges (the slot's account now). */
export const pendingCharges = () => inFlightCount("CHARGE") + listChargeRecords().filter((c) => c.status === "PROCESSING").length;

/** A payment that completed after its account withdrew: kept for the console, nothing credited. */
export function recordUncreditedCharge(charge: Omit<UncreditedCharge, "completedAt">, now = new Date()) {
  mockWallet.uncreditedCharges.unshift({ ...charge, completedAt: localStamp(now) });
}

/**
 * Whether a charge was paid without its FN being credited because its account had withdrawn (for the console). A 결제
 * 취소 credits nothing either, but nothing was paid: it is 취소, not FN 미지급.
 */
export const isUncredited = (chargeId: string) =>
  (Object.hasOwn(mockWallet.seedChargeResults, chargeId) && mockWallet.seedChargeResults[chargeId].status === "COMPLETED" && !mockWallet.seedChargeResults[chargeId].fnCredited) ||
  mockWallet.uncreditedCharges.some((u) => u.id === chargeId);

export type ChargeConfirmation = "CREDITED" | "NOT_CREDITED" | "CANCELLED" | "NOT_FOUND" | "NOT_PROCESSING";

/**
 * 결제 확인 of a 처리중 charge — what the payment provider's confirmation (webhook or status lookup, TBD) does in the
 * backend, and what the console's 처리 중 충전 decision does in the mock (2026-10-12 결정). COMPLETED credits the
 * charge's FN to the account that made it while that account still holds the slot, active (CREDITED); otherwise
 * nothing is credited and the console shows it as 완료 · FN 미지급 (탈퇴) (NOT_CREDITED). CANCELLED (결제 실패 · 취소)
 * credits nothing; the member hears of it — "FN 충전이 취소됐어요" (2026-10-13), once per charge — only while the
 * account that made it still holds the slot, active, like the 충전 완료 notification: a withdrawn account's inbox (or a
 * 재가입 account's) never gets it. Synchronous, so the check and the write are one step. The mock's only 처리중 charges
 * are the sample's (generated rows, so the result is kept in `mockWallet.seedChargeResults`).
 */
export function confirmChargePayment(chargeId: string, outcome: "COMPLETED" | "CANCELLED", now = new Date()): ChargeConfirmation {
  const charge = mockWallet.charges.some((c) => c.id === chargeId) ? null : findChargeRecord(chargeId);
  if (!charge) return "NOT_FOUND";
  if (charge.status !== "PROCESSING") return "NOT_PROCESSING";
  // The sample rows are the first account's (`accountSince()` null): is it still the slot's, active?
  const active = accountSince() === null && !isWithdrawn();
  const credited = outcome === "COMPLETED" && active;
  mockWallet.seedChargeResults[chargeId] = { status: outcome, at: localStamp(now), fnCredited: credited };
  const what = `${charge.fnAmount.toLocaleString("ko-KR")} FN · ${charge.methodLabel}`;
  if (outcome === "CANCELLED") {
    if (active) {
      notify({ kind: "CHARGE", title: "FN 충전이 취소됐어요", body: `${what} · 결제가 확인되지 않아 취소됐어요`, href: "/wallet/charges", dedupeKey: `charge-cancelled:${charge.id}` });
    }
    return "CANCELLED";
  }
  if (!credited) return "NOT_CREDITED";
  mockAccount.fnBalance += charge.fnAmount;
  notify({ kind: "CHARGE", title: "FN 충전이 완료됐어요", body: what, href: "/wallet/charges", dedupeKey: `charge:${charge.transactionId ?? charge.id}` });
  return "CREDITED";
}
