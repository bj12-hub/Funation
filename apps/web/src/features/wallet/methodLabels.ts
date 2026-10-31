import type { MessageKey } from "@/lib/i18n/translate";

/**
 * The payment method names and subtitles the services write (`chargeTypes` · `walletHistory`), as message keys so the
 * charge modal and 충전내역 show them in the viewer's language (2026-11-01). A name not listed shows as written.
 */
const KEYS: Record<string, MessageKey> = {
  "썸네이션 Pay": "walletCharge.pmSsumnationPay",
  펀페이: "walletCharge.pmFunPay",
  네이버페이: "walletCharge.pmNaverPay",
  카카오페이: "walletCharge.pmKakaoPay",
  "카카오페이 간편결제": "walletCharge.pmKakaoPayQuick",
  신용카드: "walletCharge.pmCreditCard",
  체크카드: "walletCharge.pmDebitCard",
  페이코: "walletCharge.pmPayco",
  휴대폰결제: "walletCharge.pmPhone",
  "휴대폰(간편)": "walletCharge.pmPhoneQuick",
  "휴대폰결제(간편)": "walletCharge.pmPhoneQuickLong",
  토스페이: "walletCharge.pmTossPay",
  삼성페이: "walletCharge.pmSamsungPay",
  컬쳐랜드: "walletCharge.pmCultureland",
  "컬쳐랜드 상품권": "walletCharge.pmCulturelandGift",
  가상계좌: "walletCharge.pmVirtualAccount",
  티머니: "walletCharge.pmTmoney",
  "티머니/캐시비": "walletCharge.pmTmoneyCashbee",
  SSG페이: "walletCharge.pmSsgPay",
  인터넷뱅킹: "walletCharge.pmInternetBanking",
  도서상품권: "walletCharge.pmBookGift",
  도서문화상품권: "walletCharge.pmBookCultureGift",
  "실시간 계좌이체": "walletCharge.pmBankTransfer",
  무통장입금: "walletCharge.pmBankDeposit",
  일시불: "walletCharge.pmLumpSum"
};

export function walletMethodText(label: string, t: (key: MessageKey) => string) {
  const key = KEYS[label];
  return key ? t(key) : label;
}
