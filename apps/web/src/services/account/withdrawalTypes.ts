/**
 * 회원 탈퇴 — client-safe types (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴).
 * A creator with earnings still waiting for settlement cannot withdraw yet: what happens to those
 * earnings is TBD, so the server blocks the request instead of forfeiting them.
 */

export type WithdrawalInfo = {
  nickname: string;
  /** Server balance that will be forfeited; the consent is for exactly this amount. */
  fnBalance: number;
  creator: boolean;
  /** 정산 가능 + 정산 신청 중 (creators only). */
  unsettledFn: number;
  blocked: boolean;
};

export type WithdrawResult =
  | { status: "WITHDRAWN" }
  | { status: "INVALID"; message: string }
  | { status: "BLOCKED"; unsettledFn: number }
  | { status: "UNAUTHORIZED" };
