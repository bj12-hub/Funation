import { toDateString } from "@/lib/period";
import { ownEntry } from "@/lib/records";
import { mockAccount } from "@/services/account/mockStore";
import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";
import { notify } from "@/services/notifications/notificationCore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import type { DonationCategory, DonationRecord } from "@/services/wallet/walletTypes";
import { adapterFor, type LookupResult } from "./adapters";
import { mockPlatform, type MockPlatformTransaction, type PlatformResolution } from "./mockPlatformStore";
import { PLATFORMS } from "./platformTypes";

/**
 * 결과를 모르는 플랫폼 후원 (PENDING, FN 보관) — 2026-10-08 결정. Server-only (not a "use server" module): the member's
 * 후원 내역 and retries (platformDonation/*) and the console's 확인 중 후원 (admin/pendingDonations.ts) share it.
 *
 * - For 24 hours after the request the server re-checks the result with the platform adapter (`lookupDonation`), lazily:
 *   on reads of 후원 내역, when the 회원 탈퇴 screen opens and when 탈퇴 is pressed, on a retry with the same Idempotency-Key
 *   (결과 다시 확인) and on the console list.
 * - A result settles it: COMPLETED completes the donation as a direct success does; FAILED returns the held FN with a
 *   wallet record (the FN 내역 shows the hold as FN 반환 and an FN 반환 row, 2026-10-09 결정) — unless the account that
 *   sent it has withdrawn since: then nothing is credited (a 재가입 account never gets it) and the return is recorded as
 *   forfeited.
 * - Either result notifies the member once (사이트 알림, 2026-10-09 결정) — only the account that sent it, while active.
 * - After 24 hours with no result the console lists it (확인 중 후원): an operator re-checks (다시 확인) or decides
 *   성공 / 실패 with a memo (admin/pendingDonations.ts), which settles it the same way.
 */

/** How long the server keeps re-checking a PENDING donation by itself (2026-10-08 결정). */
export const RECHECK_WINDOW_MS = 24 * 3_600_000;
/** How long one status lookup may take (sample value — the real limit is TBD). */
export const LOOKUP_TIMEOUT_MS = 5_000;
/** A lazy read asks the platform about one transaction at most this often (sample value, TBD). */
export const RECHECK_MIN_INTERVAL_MS = 60_000;

type Tx = MockPlatformTransaction;

/** Still waiting for its result (FN held). */
export const isPending = (t: Tx) => t.status === "PROCESSING" && !!t.pending;
/** Inside the 24 h the server re-checks by itself. */
export const inRecheckWindow = (t: Tx, now = Date.now()) => now - Date.parse(t.requestedAt) < RECHECK_WINDOW_MS;
/** In 확인 중 후원: no result 24 h after the request — an operator re-checks or decides it. */
export const needsOperator = (t: Tx, now = Date.now()) => isPending(t) && !inRecheckWindow(t, now);
/**
 * Whether the console lists it: was PENDING, and is still unknown after 24 h or was settled there (by an operator, or by
 * a platform answer that came after the 24 h through 다시 확인).
 */
export const listedForOperator = (t: Tx, now = Date.now()) =>
  !!t.pending && (needsOperator(t, now) || (!!t.resolution && (t.resolution.by === "OPERATOR" || !inRecheckWindow(t, Date.parse(t.resolution.at)))));

/** The account that sent it still holds the slot (the mock's 재가입 keeps the user id; services/account/rejoin.ts). */
export const sentByCurrentAccount = (t: Tx) => (t.account ?? null) === accountSince() && !isWithdrawn();

const localStamp = (d: Date) => `${toDateString(d)} ${d.toTimeString().slice(0, 8)}`;
const minuteStamp = (d: Date) => `${toDateString(d)} ${d.toTimeString().slice(0, 5)}`;

/**
 * The transaction's row in FN 후원내역 (632:4), dated at the request (when the FN was held, so the refund FIFO and the
 * account it belongs to are right); created when missing (seed rows, PENDING rows from before the hold was mirrored).
 */
export function walletMirror(t: Tx): DonationRecord & { category: DonationCategory } {
  const found = mockWallet.donations.find((d) => d.id === t.transactionId);
  if (found) return found;
  const row: DonationRecord & { category: DonationCategory } = {
    id: t.transactionId,
    donatedAt: localStamp(new Date(t.requestedAt)),
    creatorId: `${t.platform.toLowerCase()}:${t.creatorId}`,
    creatorName: t.creatorName,
    message: t.message || t.productLabel,
    fnAmount: t.fnAmount,
    typeLabel: `${PLATFORMS[t.platform].name} ${t.productLabel}`,
    category: "basic",
    status: "PROCESSING"
  };
  mockWallet.donations.unshift(row);
  return row;
}

/** One bounded lookup: a throw or no answer in time is UNKNOWN (the transaction stays PENDING). */
async function lookupBounded(t: Tx): Promise<LookupResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      adapterFor(t.platform).lookupDonation({ creatorId: t.creatorId, idempotencyKey: t.idempotencyKey, transactionId: t.transactionId }),
      new Promise<LookupResult>((resolve) => (timer = setTimeout(() => resolve({ status: "UNKNOWN" }), LOOKUP_TIMEOUT_MS)))
    ]);
  } catch {
    return { status: "UNKNOWN" };
  } finally {
    clearTimeout(timer);
  }
}

/** Applies a platform answer to a transaction that is still pending (synchronous; the caller awaited the lookup). */
function applyLookup(t: Tx, answer: LookupResult) {
  if (!isPending(t) || answer.status === "UNKNOWN") return;
  if (answer.status === "COMPLETED") settle(t, { outcome: "COMPLETED", by: "PLATFORM", externalTransactionId: answer.externalTransactionId });
  else settle(t, { outcome: "FAILED", by: "PLATFORM" });
}

/**
 * Lazy re-check: asks the platform about every pending transaction `which` selects that is inside its 24 h and was not
 * asked in the last minute. Each is claimed (`lastCheckAt`) before the calls, so concurrent reads ask once. After the
 * last await, the answers are applied in one synchronous step, each only to a transaction still pending (an operator or
 * another read may have settled it meanwhile).
 */
export async function recheckPending(which: (t: Tx) => boolean, now = Date.now()): Promise<void> {
  const due = mockPlatform.transactions.filter((t) => {
    if (!isPending(t) || !which(t) || !inRecheckWindow(t, now)) return false;
    const last = t.pending?.lastCheckAt;
    return !last || now - Date.parse(last) >= RECHECK_MIN_INTERVAL_MS;
  });
  if (due.length === 0) return;
  for (const t of due) t.pending = { lastCheckAt: new Date(now).toISOString() };
  const answers = await Promise.all(due.map(lookupBounded));
  due.forEach((t, i) => applyLookup(t, answers[i]));
}

/**
 * The lazy re-check for the signed-in account's own pending donations (the account holding the slot now, not a withdrawn
 * one): on reads of 후원 내역, when the 회원 탈퇴 screen opens and when 탈퇴 is pressed, so a result that has come in no
 * longer blocks it.
 */
export const recheckAccountPending = (now = Date.now()) => recheckPending((t) => (t.account ?? null) === accountSince(), now);

/**
 * 다시 확인 (console): asks the platform now, whatever the age or the last check. Answers what the platform said, or
 * SETTLED when the transaction was settled while the lookup ran (its answer is then not applied).
 */
export async function checkNow(t: Tx): Promise<LookupResult["status"] | "SETTLED"> {
  t.pending = { lastCheckAt: new Date().toISOString() };
  const answer = await lookupBounded(t);
  if (!isPending(t)) return "SETTLED";
  applyLookup(t, answer);
  return answer.status;
}

/**
 * 사이트 알림 for a settled PENDING donation (2026-10-09 결정), whoever settled it (a re-check or an operator): once per
 * transaction (`dedupeKey`), and only while the account that sent it is the slot's active account — never to a withdrawn
 * one (its FN were forfeited with it, and a 재가입 account's inbox is not its own).
 */
function notifyResolved(t: Tx, fnReturn: PlatformResolution["fnReturn"]) {
  if (!sentByCurrentAccount(t) || fnReturn === "FORFEITED") return;
  const sent = `${PLATFORMS[t.platform].name} · ${t.creatorName}님께 ${t.fnAmount.toLocaleString("ko-KR")} FN`;
  const completed = t.status === "COMPLETED";
  notify({
    kind: "DONATION_SENT",
    title: completed ? "확인 중이던 후원이 완료됐어요" : "확인 중이던 후원이 실패했어요",
    body: completed ? sent : `${sent} · FN 반환`,
    href: `/donation/history?period=all&tx=${encodeURIComponent(t.transactionId)}`,
    dedupeKey: `platform-pending:${t.transactionId}`
  });
}

type Decision =
  | { outcome: "COMPLETED"; by: "PLATFORM"; externalTransactionId: string }
  | { outcome: "FAILED"; by: "PLATFORM" }
  | { outcome: "COMPLETED" | "FAILED"; by: "OPERATOR"; operator: string; note: string; requestId: string };

/**
 * Settles a pending transaction (synchronous — the caller checked `isPending` in the same step). COMPLETED: the FN held
 * is spent, as a direct success. FAILED: the held FN goes back to the account that sent it, with a wallet record — or,
 * when that account has withdrawn since, is forfeited (never credited to whoever holds the slot now). The same
 * Idempotency-Key then answers with the result instead of PENDING.
 */
export function settle(t: Tx, d: Decision, now = new Date()): PlatformResolution {
  const mirror = walletMirror(t);
  const name = PLATFORMS[t.platform].name;
  let fnReturn: PlatformResolution["fnReturn"] = null;
  if (d.outcome === "COMPLETED") {
    t.status = "COMPLETED";
    if (d.by === "PLATFORM") t.externalTransactionId = d.externalTransactionId;
    t.completedAt = minuteStamp(now);
    mirror.status = "COMPLETED";
  } else if (sentByCurrentAccount(t)) {
    t.status = "FAILED";
    t.failureReason = `${d.by === "PLATFORM" ? `${name} 확인 결과` : "운영자 확인 결과"} 실패 · FN 반환`;
    mockAccount.fnBalance += t.fnAmount;
    mirror.status = "REFUNDED";
    mirror.refundedAt = localStamp(now);
    // Not a refund (2026-10-09 결정): the FN 내역 and its CSV say "FN 반환", as 후원 내역 says 실패 · FN 반환.
    mirror.fnReturned = true;
    fnReturn = "RETURNED";
  } else {
    // The withdrawn account's FN were forfeited with it (회원 탈퇴): nothing is credited, also not after a 재가입.
    t.status = "FAILED";
    t.failureReason = "확인 결과 실패 · 탈퇴한 계정이라 FN 반환 불가(소멸)";
    mirror.status = "FAILED";
    fnReturn = "FORFEITED";
  }
  const resolution: PlatformResolution = {
    outcome: d.outcome,
    at: now.toISOString(),
    by: d.by,
    operator: d.by === "OPERATOR" ? d.operator : null,
    note: d.by === "OPERATOR" ? d.note : null,
    requestId: d.by === "OPERATOR" ? d.requestId : null,
    fnReturn
  };
  t.resolution = resolution;
  notifyResolved(t, fnReturn);
  const entry = t.idempotencyKey ? ownEntry(mockPlatform.idempotency, t.idempotencyKey) : undefined;
  if (entry) {
    entry.result =
      d.outcome === "COMPLETED"
        ? { status: "COMPLETED", transactionId: t.transactionId, externalTransactionId: t.externalTransactionId, creatorName: t.creatorName, productLabel: t.productLabel, fnAmount: t.fnAmount, balance: mockAccount.fnBalance }
        : { status: "FAILED", reason: "API_ERROR" };
  }
  return resolution;
}
