/**
 * 회원 탈퇴 — client-safe types (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기
 * 수익도 소멸 동의 후 탈퇴, 탈퇴 직전 비밀번호 재입력; 2026-10-06: 처리 중인 충전 환불이 있으면 탈퇴 불가; 2026-10-08:
 * 진행 중인 퀘스트 후원이 있으면 탈퇴 불가).
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
  | { status: "WRONG_PASSWORD" }
  /** 5 wrong passwords (shared with the login): the account is locked and the session ended — reset the password. */
  | { status: "LOCKED" }
  | { status: "UNAUTHORIZED" };
