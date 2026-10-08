/**
 * SMS 계좌후원 — code-first mock (funnation "SMS 계좌후원 연결", 2026-10-06 결정). A text-forwarding app on the
 * creator's phone posts bank deposit SMS to a secret address; the deposit (amount + depositor name only) becomes a
 * "계좌 후원" alert and, during a crew broadcast, a 원 entry in the 후원 리스트. It is not a Ssumnation payment: no FN,
 * wallet, earnings or settlement records. The SMS text, account number and balance are never stored.
 * TBD: real bank formats, forwarder apps, privacy notice and retention, abuse limits.
 */

export const BANK_SMS_LIMITS = { textMax: 1000, amountMax: 10_000_000, depositorMax: 20, recent: 20 } as const;

/** One recognised deposit as the studio shows it (the depositor is already masked when 이름 가리기 is on). */
export type BankDeposit = { id: string; depositor: string; amount: number; receivedAt: string };

export type BankSmsView = {
  enabled: boolean;
  /** 입금자명 가리기 (on by default): alerts and lists show 별***타. */
  maskNames: boolean;
  /** Webhook path with the secret key (creator-only page; the screen shows it masked). */
  hookPath: string;
  received: number;
  duplicates: number;
  unparsed: number;
  recent: BankDeposit[];
};

export type BankSmsOutcome = { status: "OK"; deposit: BankDeposit } | { status: "DUPLICATE" } | { status: "UNPARSED" } | { status: "OFF" };
export type BankSmsResult = BankSmsOutcome | { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** 별빛소나타 → 별***타, 민수 → 민*, 한 글자는 그대로. */
export function maskName(name: string): string {
  const chars = [...name];
  if (chars.length <= 1) return name;
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars.at(-1)}`;
}

/** A deposit SMS in a common bank layout, with the account number and balance already masked (test only). */
export const SAMPLE_BANK_SMS = "[Web발신]\n[국민]10/06 14:05\n***-****-****\n별빛소나타\n입금\n10,000\n잔액 ******";
