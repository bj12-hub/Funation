import type { RequestResult, SettlementGate, SettlementQuote } from "@/services/creator/settlementTypes";

/**
 * 정산 신청 확인 (473:2) → 확인: what the flow does with the server's answer. Kept apart from the component so the rule
 * is testable: an answer that never arrived (the connection dropped, the server restarted) is UNKNOWN — the request may
 * have been made — so the flow stays on the confirm step with the same quote and Idempotency-Key, and the next 확인
 * returns that request instead of making a second one (as the FN 충전 and 플랫폼 후원 flows do).
 */
export type SubmitAnswer = RequestResult | { status: "UNKNOWN" };

export const SUBMIT_UNKNOWN_MESSAGE = "신청 결과를 확인하지 못했어요. 다시 확인을 누르면 같은 신청으로 확인돼요 (두 번 신청되지 않아요).";

/** Calls the server; a call that throws comes back as UNKNOWN instead of turning the page into the error screen. */
export async function askServer(call: () => Promise<RequestResult>): Promise<SubmitAnswer> {
  try {
    return await call();
  } catch {
    return { status: "UNKNOWN" };
  }
}

export type SubmitNext =
  | { step: "complete"; quote: SettlementQuote }
  /** Same quote and key: 확인 again asks about the same request. */
  | { step: "confirm"; error: string }
  /** Back to the amount: the next quote gets a new key. */
  | { step: "request"; error: string }
  | { leave: "UNAUTHORIZED" | SettlementGate };

export function afterSubmit(answer: SubmitAnswer): SubmitNext {
  switch (answer.status) {
    case "REQUESTED":
      return { step: "complete", quote: answer.quote };
    case "UNKNOWN":
      return { step: "confirm", error: SUBMIT_UNKNOWN_MESSAGE };
    case "INVALID":
      return { step: "request", error: answer.message };
    case "CONFLICT":
      return { step: "request", error: "요청이 중복되었어요. 금액을 확인하고 다시 신청해 주세요." };
    default:
      return { leave: answer.status };
  }
}
