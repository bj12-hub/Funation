import { accountSince } from "@/services/account/withdrawalCore";
import type { Inquiry } from "./supportTypes";

/**
 * 1:1 문의 store — server-only, not a "use server" module, so the retention purge can reach a withdrawn account's
 * inquiries (services/account/retentionPurge.ts) without them being callable from the browser.
 */

type Store = { byUser: Record<string, Inquiry[]>; requests: Record<string, string> };
const g = globalThis as typeof globalThis & { __ssumnationMockInquiriesV1?: Store };
export const inquiryStore = (): Store => (g.__ssumnationMockInquiriesV1 ??= { byUser: {}, requests: {} });

/**
 * Inquiries belong to the account that wrote them. The mock's 재가입 reuses the user id, so an account is told apart by
 * its start marker (`accountSince`, null for the first one, which keeps the plain user id): a new account never reads
 * the withdrawn account's inquiries, which stay stored for the operators until the 분쟁 처리 기록 retention ends.
 */
export const inquiryAccountKey = (userId: string, since: string | null = accountSince()) => (since ? `${userId}@${since}` : userId);

/** Removes an account's inquiries and the request ids that created them. */
export function forgetInquiries(account: string) {
  const store = inquiryStore();
  delete store.byUser[account];
  for (const k of Object.keys(store.requests)) if (k.startsWith(`${account}:`)) delete store.requests[k];
}
