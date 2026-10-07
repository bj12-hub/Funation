import { formatNumber } from "@/lib/format";
import type { PlatformErrorCode } from "@/services/platforms/platformTypes";
import type { Platform } from "@/types/platform";

/**
 * 후원 연동 — code-first (funnation 위젯 도구 "후원 연동: 외부 후원 플랫폼을 연결"). Client-safe types.
 * Donations made on a broadcast platform show up in our 후원 알림 in their own currency. They are not
 * Somnation payments: no FN, wallet, earnings or settlement records are created (TBD: reporting).
 */

export type DonationLinkState = {
  platform: Platform;
  /** The platform adapter declares DONATION_EVENTS. */
  supported: boolean;
  /** Declared by the mock but not yet confirmed against the platform's real API (TBD) — shown as 「API 확인 중」. */
  unverified: boolean;
  /** The platform account is connected (YouTube: 유튜브 연동). */
  connected: boolean;
  enabled: boolean;
  received: number;
  duplicates: number;
  /** Events the platform delivered in a shape we could not read (bad time, amount …): dropped, not shown. */
  skipped: number;
  lastEventAt: string | null;
  /** The last read failed (timeout, outage …); the other platforms keep working. Cleared by the next good read. */
  lastError: PlatformErrorCode | null;
};

export type LinkedDonation = { key: string; platform: Platform; donor: string; message: string; amountLabel: string; kindLabel: string; receivedAt: string };

export type DonationLinkView = { links: DonationLinkState[]; recent: LinkedDonation[] };

export const SIM_CURRENCIES = ["KRW", "USD", "JPY"] as const;
export type SimCurrency = (typeof SIM_CURRENCIES)[number];

export const formatMoney = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency }).format(value);
  } catch {
    // Platform units (치즈 · 별풍선 …) are not ISO currencies.
    return `${formatNumber(value)} ${currency}`;
  }
};

export type DonationLinkResult = { status: "OK"; ingested?: number; duplicates?: number } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
