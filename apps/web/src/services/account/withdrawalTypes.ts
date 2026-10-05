/**
 * 회원 탈퇴 — client-safe types (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기
 * 수익도 소멸 동의 후 탈퇴, 탈퇴 직전 비밀번호 재입력).
 */

export type WithdrawalInfo = {
  nickname: string;
  /** Server balance that will be forfeited; the consent is for exactly this amount. */
  fnBalance: number;
  creator: boolean;
  /** 정산 가능 + 정산 신청 중 (creators only); forfeited with its own consent. */
  unsettledFn: number;
};

export type WithdrawResult = { status: "WITHDRAWN" } | { status: "INVALID"; message: string } | { status: "WRONG_PASSWORD" } | { status: "UNAUTHORIZED" };
