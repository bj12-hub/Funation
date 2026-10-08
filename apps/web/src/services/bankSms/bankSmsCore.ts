import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { enqueueAlert } from "@/services/creator/alertCore";
import { formatMoney } from "@/services/creator/donationLinkTypes";
import { recordBroadcastBank } from "@/services/crew/crewCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { parseDepositSms } from "./bankSmsParser";
import { BANK_SMS_LIMITS, maskName, type BankDeposit, type BankSmsOutcome } from "./bankSmsTypes";

/**
 * Server-only SMS 계좌후원 state (not a "use server" module): shared by the studio actions and the webhook route.
 * A delivery is a repeat when its forwarder message id or its text was seen in the last day. The text is kept only as
 * an HMAC under a secret that is not part of the stored state (an unkeyed hash of a known SMS layout could be
 * reversed to the balance); the real backend would read the secret from its environment (TBD).
 */

type Store = {
  enabled: boolean;
  maskNames: boolean;
  key: string;
  /** Delivery ids and text HMACs handled in the last SEEN_MS (oldest first, capped). */
  seen: { key: string; at: number }[];
  stats: { received: number; duplicates: number; unparsed: number };
  /** Raw depositor names stay here so 이름 가리기 can be switched either way. */
  recent: BankDeposit[];
};

const SEEN_MAX = 5_000;
const SEEN_MS = 24 * 60 * 60 * 1000;
// V2: `seen` holds keyed entries with a time (V1 kept bare SHA-256 hashes of the text).
const g = globalThis as typeof globalThis & { __ssumnationMockBankSmsV2?: Store; __ssumnationBankSmsSecret?: Buffer };
export const bankSmsStore = (): Store =>
  (g.__ssumnationMockBankSmsV2 ??= { enabled: false, maskNames: true, key: randomUUID(), seen: [], stats: { received: 0, duplicates: 0, unparsed: 0 }, recent: [] });
// Not under __ssumnationMock*: test resets keep it, and it never sits next to the hashes it protects.
const secret = () => (g.__ssumnationBankSmsSecret ??= randomBytes(32));
const textKey = (text: string) => `txt:${createHmac("sha256", secret()).update(text.replace(/\s+/g, " ").trim()).digest("hex")}`;

export const shownName = (s: Store, name: string) => (s.maskNames ? maskName(name) : name);

/**
 * Handles one forwarded SMS: parse → alert (+ 후원 리스트 during a crew broadcast). `deliveryId` is the forwarder's
 * message id when it has one; a repeat (or the same text again without an id) is counted, not shown.
 */
export function receiveBankSms(text: string, deliveryId: string | null, now = Date.now()): BankSmsOutcome {
  const s = bankSmsStore();
  if (!s.enabled) return { status: "OFF" };
  s.seen = s.seen.filter((e) => now - e.at < SEEN_MS);
  // Both keys count: a retry with a new id, or the same SMS from a second forwarder without one, is still a repeat.
  const keys = [textKey(text), ...(deliveryId ? [`id:${deliveryId}`] : [])];
  if (s.seen.some((e) => keys.includes(e.key))) {
    s.stats.duplicates++;
    return { status: "DUPLICATE" };
  }
  const parsed = parseDepositSms(text);
  if (!parsed) {
    s.stats.unparsed++;
    return { status: "UNPARSED" };
  }
  s.seen.push(...keys.map((key) => ({ key, at: now })));
  if (s.seen.length > SEEN_MAX) s.seen.splice(0, s.seen.length - SEEN_MAX);
  const deposit: BankDeposit = { id: `bank-${randomUUID()}`, depositor: parsed.depositor, amount: parsed.amount, receivedAt: new Date().toISOString() };
  const donor = shownName(s, parsed.depositor);
  enqueueAlert({ kind: "EXTERNAL", donor, message: "", fnAmount: 0, amountLabel: formatMoney(parsed.amount, "KRW"), typeLabel: "계좌 후원", native: { value: parsed.amount, unit: "KRW" } });
  recordBroadcastBank(STUDIO_CHANNEL, { donor, value: parsed.amount });
  s.recent.unshift(deposit);
  s.recent.length = Math.min(s.recent.length, BANK_SMS_LIMITS.recent);
  s.stats.received++;
  return { status: "OK", deposit: { ...deposit, depositor: donor } };
}
