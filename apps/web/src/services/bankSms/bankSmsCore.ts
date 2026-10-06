import { createHash, randomUUID } from "node:crypto";
import { enqueueAlert } from "@/services/creator/alertCore";
import { formatMoney } from "@/services/creator/donationLinkTypes";
import { recordBroadcastBank } from "@/services/crew/crewCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { parseDepositSms } from "./bankSmsParser";
import { BANK_SMS_LIMITS, maskName, type BankDeposit, type BankSmsOutcome } from "./bankSmsTypes";

/**
 * Server-only SMS 계좌후원 state (not a "use server" module): shared by the studio actions and the webhook route.
 * Deliveries are deduped by the forwarder's message id, or by a hash of the text when it sends none; only the
 * hash is kept, never the text.
 */

type Store = {
  enabled: boolean;
  maskNames: boolean;
  key: string;
  /** Delivery ids and text hashes already handled (oldest first, capped). */
  seen: string[];
  stats: { received: number; duplicates: number; unparsed: number };
  /** Raw depositor names stay here so 이름 가리기 can be switched either way. */
  recent: BankDeposit[];
};

const SEEN_MAX = 5_000;
const g = globalThis as typeof globalThis & { __funationMockBankSmsV1?: Store };
export const bankSmsStore = (): Store =>
  (g.__funationMockBankSmsV1 ??= { enabled: false, maskNames: true, key: randomUUID(), seen: [], stats: { received: 0, duplicates: 0, unparsed: 0 }, recent: [] });

export const shownName = (s: Store, name: string) => (s.maskNames ? maskName(name) : name);

/**
 * Handles one forwarded SMS: parse → alert (+ 후원 리스트 during a crew broadcast). `deliveryId` is the forwarder's
 * message id when it has one; a repeat (or the same text again without an id) is counted, not shown.
 */
export function receiveBankSms(text: string, deliveryId: string | null): BankSmsOutcome {
  const s = bankSmsStore();
  if (!s.enabled) return { status: "OFF" };
  const dedupe = deliveryId ? `id:${deliveryId}` : `sha:${createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex")}`;
  if (s.seen.includes(dedupe)) {
    s.stats.duplicates++;
    return { status: "DUPLICATE" };
  }
  const parsed = parseDepositSms(text);
  if (!parsed) {
    s.stats.unparsed++;
    return { status: "UNPARSED" };
  }
  s.seen.push(dedupe);
  if (s.seen.length > SEEN_MAX) s.seen.splice(0, s.seen.length - SEEN_MAX);
  const deposit: BankDeposit = { id: `bank-${randomUUID()}`, depositor: parsed.depositor, amount: parsed.amount, receivedAt: new Date().toISOString() };
  const donor = shownName(s, parsed.depositor);
  enqueueAlert({ kind: "EXTERNAL", donor, message: "", fnAmount: 0, amountLabel: formatMoney(parsed.amount, "KRW"), typeLabel: "계좌 후원", native: { value: parsed.amount, currency: "KRW" } });
  recordBroadcastBank(STUDIO_CHANNEL, { donor, value: parsed.amount });
  s.recent.unshift(deposit);
  s.recent.length = Math.min(s.recent.length, BANK_SMS_LIMITS.recent);
  s.stats.received++;
  return { status: "OK", deposit: { ...deposit, depositor: donor } };
}
