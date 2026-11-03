import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mockAccount, mockCredentials } from "./mockStore";
import { isRetentionExpired, retentionUntil } from "./retentionPolicy";
import { withdrawalStore, withdrawnAccounts, type CancelledWithdrawalRequest, type Withdrawal, type WithdrawalConsents } from "./withdrawalCore";

/** Server-only half of ./withdrawalCore.ts: the parts that need node:crypto (the phone hash and new person keys). */

/** The HMAC key for phone hashes, made once per mock store. */
const hashKey = () => (withdrawalStore().phoneHashKey ||= randomBytes(32).toString("hex"));

/** A keyed hash of the phone's digits: compares numbers without keeping them. */
const phoneHash = (phone: string) => createHmac("sha256", hashKey()).update(phone.replace(/\D/g, "")).digest("hex");

/**
 * Records the slot account's withdrawal. The 본인 확인 값 moves out of the account's credentials into the record (the
 * phone only as a keyed hash); the caller destroys the rest of the account's personal data (./withdrawalApply.ts).
 * `requestedAt`: when the member asked (the 탈퇴 신청), null when written without one; `cancelled`: the account's
 * earlier 탈퇴 신청 it cancelled.
 */
export function recordWithdrawal(r: {
  at: string;
  requestedAt?: string | null;
  requestId: string;
  forfeitedFn: number;
  forfeitedEarningsFn: number;
  consented?: { fn: number; earningsFn: number } | null;
  cancelled?: CancelledWithdrawalRequest[];
  consents?: WithdrawalConsents;
}): Withdrawal {
  const record: Withdrawal = {
    at: r.at,
    requestedAt: r.requestedAt ?? null,
    requestId: r.requestId,
    forfeitedFn: r.forfeitedFn,
    forfeitedEarningsFn: r.forfeitedEarningsFn,
    consented: r.consented ?? null,
    cancelled: r.cancelled ?? [],
    nickname: mockAccount.nickname,
    ssumnationId: mockAccount.ssumnationId,
    consents: r.consents ?? { chargeTerms: null, settlementTerms: null },
    person: mockCredentials.personKey ? { key: mockCredentials.personKey, phoneHash: phoneHash(mockCredentials.phone) } : null,
    purged: []
  };
  Object.assign(mockCredentials, { phone: "", personKey: "" });
  return (withdrawalStore().withdrawal = record);
}

/**
 * The person key for an account whose verified phone is `phone`: the key of the latest withdrawn account with that
 * phone whose 본인 확인 값 is still kept at `now` (the same person signing up again), otherwise a new one.
 */
export function personKeyFor(phone: string, now: Date): string {
  const hash = phoneHash(phone);
  const kept = withdrawnAccounts()
    .map((a) => a.record)
    .filter((w) => w.person?.phoneHash === hash && !isRetentionExpired(retentionUntil(w.at, "PERSON_KEY"), now))
    .at(-1);
  return kept?.person?.key ?? randomUUID();
}
