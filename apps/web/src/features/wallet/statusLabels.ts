import type { MessageKey } from "@/lib/i18n/translate";

/**
 * The status labels the wallet services write (`walletTypes` · `walletHistory`: 충전 · 후원 · 환불 · 적립 · 소멸 rows), as message
 * keys so the FN Wallet and 후원내역 show them in the viewer's language (2026-11-01). A label not listed shows as written.
 */
const KEYS: Record<string, MessageKey> = {
  완료: "wallet.statusDone",
  처리중: "wallet.statusProcessing",
  "결제 취소": "wallet.chargeCancelled",
  실패: "wallet.statusFailed",
  환불중: "wallet.statusRefunding",
  환불완료: "wallet.statusRefunded",
  소멸: "wallet.statusForfeited",
  "FN 반환": "wallet.statusFnReturned"
};

export function walletStatusText(label: string, t: (key: MessageKey) => string) {
  const key = KEYS[label];
  return key ? t(key) : label;
}
