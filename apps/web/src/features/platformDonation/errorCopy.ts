/**
 * 플랫폼 후원 오류 화면 copy — Figma 817:9618 · 817:8948, plus RESULT_FAILED (code-first): a PENDING donation whose
 * result turned out 실패 after its FN were held (2026-10-08 결정), answered to 「결과 다시 확인」. Its FN went back
 * (FN 반환, 2026-10-09 결정), so it must not say "FN은 차감되지 않았습니다." — the FN 내역 shows the hold and the FN 반환.
 */
export type PlatformErrorKind = "API_ERROR" | "UNAVAILABLE" | "NOT_FOUND" | "RESULT_FAILED" | "PENDING" | "IN_PROGRESS" | "NETWORK" | "INVALID";

/** `fnLine`: what happened to the FN (shown under the text), or null. */
export type PlatformErrorCopy = { title: string; text: string; fnLine: string | null; pending?: boolean; searchAgain?: boolean };

const NOT_CHARGED = "FN은 차감되지 않았습니다.";

/** `fnReturned`: RESULT_FAILED only — the held FN went back (false: forfeited, the sender's account has withdrawn). */
export function platformErrorCopy(kind: PlatformErrorKind, platform: string, fnReturned = false): PlatformErrorCopy {
  switch (kind) {
    case "API_ERROR":
      return { title: "후원에 실패했습니다.", text: `${platform} 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.`, fnLine: NOT_CHARGED };
    case "UNAVAILABLE":
      return { title: "후원상품을 사용할 수 없음", text: "현재 선택한 상품의 판매가 중지되었습니다.", fnLine: NOT_CHARGED };
    case "NOT_FOUND":
      return { title: "스트리머를 찾을 수 없음", text: "닉네임 또는 ID를 다시 확인해주세요.", fnLine: NOT_CHARGED, searchAgain: true };
    case "RESULT_FAILED":
      return { title: "후원에 실패했습니다.", text: "후원 결과가 실패로 확인되었습니다.", fnLine: fnReturned ? "보류된 FN은 반환되었습니다." : null };
    case "NETWORK":
      return { title: "네트워크 오류", text: "인터넷 연결을 확인하고 다시 시도해주세요.", fnLine: null };
    case "PENDING":
      return { title: "처리 결과 확인 중", text: `${platform}에서 후원 결과를 확인하고 있습니다.`, fnLine: null, pending: true };
    case "IN_PROGRESS":
      return { title: "중복 요청", text: "이미 동일한 후원이 처리 중입니다.", fnLine: null, pending: true };
    case "INVALID":
      return { title: "후원에 실패했습니다.", text: "후원 처리 중 문제가 발생했습니다.", fnLine: NOT_CHARGED };
  }
}
