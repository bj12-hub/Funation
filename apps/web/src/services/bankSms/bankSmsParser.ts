import { BANK_SMS_LIMITS } from "./bankSmsTypes";

/**
 * Mock parser for bank deposit SMS (code-first, 2026-10-06). Real formats differ by bank and change without notice
 * (TBD: per-bank adapters). Returns only the amount (원) and the depositor; account numbers, balances, dates and
 * the bank name are never returned. 출금 · 입금취소 messages are not deposits.
 */

const BANKS = ["국민", "KB", "신한", "우리", "하나", "농협", "NH", "기업", "IBK", "카카오뱅크", "카카오", "토스뱅크", "토스", "케이뱅크", "새마을", "우체국", "SC제일", "씨티", "수협", "부산", "대구", "광주", "전북", "경남", "제주", "신협"];
const WORDS = ["Web발신", "web발신", "입금", "잔액", "출금", "원", "님", "알림", "계좌", "이체"];

const toAmount = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 1 && n <= BANK_SMS_LIMITS.amountMax ? n : null;
};

function findAmount(text: string): number | null {
  // "입금 10,000원" · "입금10,000" · "10,000원 입금" · "10,000원을 입금" — a number followed by / : . is a date or time.
  const inline = text.match(/입금\s*([\d,]+)(?![\d/:.])\s*원?/) ?? text.match(/([\d,]+)\s*원(?:을|이)?\s*입금/);
  if (inline) return toAmount(inline[1]);
  // "입금 10/06 14:05 50,000원": the first 원 amount that is not the balance.
  const won = [...text.matchAll(/(잔액\s*)?([\d,]+)\s*원/g)].find((m) => !m[1]);
  if (won) return toAmount(won[2]);
  // Line layout: "입금" on its own line, the amount on the next.
  const lines = text.split(/\n/).map((l) => l.trim());
  const i = lines.findIndex((l) => l === "입금");
  if (i >= 0 && /^[\d,]+\s*원?$/.test(lines[i + 1] ?? "")) return toAmount(lines[i + 1].replace(/원$/, ""));
  return null;
}

function findDepositor(text: string): string | null {
  const tokens = text
    .split(/\s+/)
    .map((t) => t.replace(/^[[(]+|[\])]+$/g, "").replace(/님(?:이|께서)?$/, ""))
    .filter((t) => t.length >= 2 && t.length <= BANK_SMS_LIMITS.depositorMax)
    // No digits, masks or separators (dates, times, account numbers, amounts), no bank names or SMS words.
    .filter((t) => !/[\d*:/\-.,]/.test(t) && !BANKS.includes(t) && !WORDS.some((w) => t.includes(w)));
  return tokens.at(-1) ?? null;
}

export function parseDepositSms(raw: string): { amount: number; depositor: string } | null {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text.includes("입금") || /입금\s*취소|출금/.test(text)) return null;
  const amount = findAmount(text);
  const depositor = findDepositor(text);
  return amount && depositor ? { amount, depositor } : null;
}
