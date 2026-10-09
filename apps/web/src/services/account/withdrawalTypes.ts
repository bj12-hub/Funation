/**
 * 회원 탈퇴 — client-safe types (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기
 * 수익도 소멸 동의 후 탈퇴, 탈퇴 직전 비밀번호 재입력; 2026-10-06: 처리 중인 충전 환불이 있으면 탈퇴 불가; 2026-10-08:
 * 진행 중인 퀘스트 후원이 있으면 탈퇴 불가; 2026-10-09: 결과를 확인 중인 플랫폼 후원이 있으면 탈퇴 불가; 2026-10-10:
 * 처리 중인 충전 · 지급 중인 출석 보상이 있으면 탈퇴 불가).
 */

export type WithdrawalInfo = {
  nickname: string;
  /** Server balance that will be forfeited; the consent is for exactly this amount. */
  fnBalance: number;
  creator: boolean;
  /** 정산 가능 + 심사 대기 정산 신청 (creators only); forfeited with its own consent. Approved requests are still paid. */
  unsettledFn: number;
  /** FN 충전 환불 requests still waiting for an operator (2026-10-06 결정: 처리가 끝나야 탈퇴할 수 있어요). */
  pendingRefunds: number;
  /** 퀘스트 후원 still in progress (2026-10-08 결정: 결과가 정해져야 탈퇴할 수 있어요). */
  pendingQuests: PendingQuests;
  /**
   * 플랫폼 후원 (SOOP · FlexTV) of this account whose result is still unknown, FN held — PENDING, or its platform call
   * still running (2026-10-09 결정: 결과가 정해져야 탈퇴할 수 있어요).
   */
  pendingPlatformDonations: number;
  /**
   * FN 충전 of this account still in progress: its payment provider call still running, or 처리중 waiting for the payment
   * to be confirmed (2026-10-10 결정: 충전이 끝나야 탈퇴할 수 있어요).
   */
  pendingCharges: number;
  /** 출석 보상 of this account still on their way to the balance (2026-10-10 결정: 지급이 끝나야 탈퇴할 수 있어요). */
  pendingAttendanceRewards: number;
};

/**
 * 퀘스트 후원 in progress — the FN is held and no result (성공 · 실패 · 취소) is decided yet. `sent`: quests this member
 * sent. `received`: quests sent to the member's channel (creators only; 0 otherwise).
 */
export type PendingQuests = { sent: number; received: number };

export type WithdrawResult =
  | { status: "WITHDRAWN" }
  | { status: "INVALID"; message: string }
  | { status: "REFUND_PENDING"; count: number }
  | ({ status: "QUEST_PENDING" } & PendingQuests)
  | { status: "PLATFORM_PENDING"; count: number }
  | { status: "CHARGE_PENDING"; count: number }
  | { status: "ATTENDANCE_PENDING"; count: number }
  | { status: "WRONG_PASSWORD" }
  /** 5 wrong passwords (shared with the login): the account is locked and the session ended — reset the password. */
  | { status: "LOCKED" }
  | { status: "UNAUTHORIZED" };
