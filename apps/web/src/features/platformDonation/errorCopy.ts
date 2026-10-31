import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";

/**
 * 플랫폼 후원 오류 화면 copy — Figma 817:9618 · 817:8948, plus RESULT_FAILED (code-first): a PENDING donation whose
 * result turned out 실패 after its FN were held (2026-10-08 결정), answered to 「결과 다시 확인」. Its FN went back
 * (FN 반환, 2026-10-09 결정), so it must not say "FN은 차감되지 않았습니다." — the FN 내역 shows the hold and the FN 반환.
 */
export type PlatformErrorKind = "API_ERROR" | "UNAVAILABLE" | "NOT_FOUND" | "RESULT_FAILED" | "PENDING" | "IN_PROGRESS" | "NETWORK" | "INVALID";

/** `fnLine`: what happened to the FN (shown under the text), or null. */
export type PlatformErrorCopy = { title: string; text: string; fnLine: string | null; pending?: boolean; searchAgain?: boolean };

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const korean: T = (key, vars) => translate(messagesFor("ko"), key, vars);

/**
 * `fnReturned`: RESULT_FAILED only — the held FN went back (false: forfeited, the sender's account has withdrawn).
 * `t`: the viewer's language (2026-11-01); Korean when left out.
 */
export function platformErrorCopy(kind: PlatformErrorKind, platform: string, fnReturned = false, t: T = korean): PlatformErrorCopy {
  const notCharged = t("platformDonation.notCharged");
  switch (kind) {
    case "API_ERROR":
      return { title: t("platformDonation.failed"), text: t("platformDonation.apiError", { platform }), fnLine: notCharged };
    case "UNAVAILABLE":
      return { title: t("platformDonation.unavailableTitle"), text: t("platformDonation.unavailableText"), fnLine: notCharged };
    case "NOT_FOUND":
      return { title: t("platformDonation.notFoundTitle"), text: t("platformDonation.checkId"), fnLine: notCharged, searchAgain: true };
    case "RESULT_FAILED":
      return { title: t("platformDonation.failed"), text: t("platformDonation.resultFailed"), fnLine: fnReturned ? t("platformDonation.fnReturned") : null };
    case "NETWORK":
      return { title: t("platformDonation.networkTitle"), text: t("platformDonation.networkText"), fnLine: null };
    case "PENDING":
      return { title: t("platformDonation.pendingTitle"), text: t("platformDonation.pendingText", { platform }), fnLine: null, pending: true };
    case "IN_PROGRESS":
      return { title: t("platformDonation.duplicateTitle"), text: t("platformDonation.duplicateText"), fnLine: null, pending: true };
    case "INVALID":
      return { title: t("platformDonation.failed"), text: t("platformDonation.invalidText"), fnLine: notCharged };
  }
}
