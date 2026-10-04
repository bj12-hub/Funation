"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession, hasRole, revokeSession } from "@/lib/session";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { mockAccount } from "./mockStore";
import { withdrawalOf, withdrawalStore } from "./withdrawalCore";
import type { WithdrawResult, WithdrawalInfo } from "./withdrawalTypes";

/**
 * 회원 탈퇴 — code-first, route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴).
 * The server re-checks the session, the creator settlement block and both consents, forfeits exactly the
 * balance the member agreed to, and ends the session. One request id per intended withdrawal, so a
 * retry after a lost response gets the same answer. TBD: re-authentication, rejoining, record retention.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Withdrawal API is not connected yet.");
};

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

/** Creator earnings not paid out yet: 정산 가능 FN + 정산 신청 중 (their handling on withdrawal is TBD). */
const unsettledFn = () => mockSettlement.availableFn + mockSettlement.requests.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amountFn, 0);

export async function getWithdrawalInfo(): Promise<WithdrawalInfo | null> {
  assertMock();
  const session = await getSession();
  if (!session) return null;
  await mockDelay(200);
  const creator = hasRole(session, "CREATOR");
  const unsettled = creator ? unsettledFn() : 0;
  return { nickname: mockAccount.nickname, fnBalance: mockAccount.fnBalance, creator, unsettledFn: unsettled, blocked: unsettled > 0 };
}

export async function withdrawAccount(input: unknown): Promise<WithdrawResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "요청을 확인해 주세요." };
  // The same request again (e.g. the response was lost): it already went through, and the session is gone.
  if (withdrawalOf()?.requestId === v.requestId) return { status: "WITHDRAWN" };
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (hasRole(session, "CREATOR")) {
    const unsettled = unsettledFn();
    if (unsettled > 0) return { status: "BLOCKED", unsettledFn: unsettled };
  }
  if (v.confirmed !== true) return { status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." };
  const balance = mockAccount.fnBalance;
  // The consent covers the amount the member saw; a balance that changed since needs a new look.
  if (v.fnBalance !== balance) return { status: "INVALID", message: "남은 FN이 바뀌었어요. 금액을 다시 확인해 주세요." };
  if (balance > 0 && v.forfeitAgreed !== true) return { status: "INVALID", message: "남은 FN 소멸에 동의해 주세요." };
  await mockDelay(400);

  withdrawalStore().withdrawal = { at: new Date().toISOString(), requestId: v.requestId, forfeitedFn: balance };
  mockAccount.fnBalance = 0;
  mockAccount.linkedLoginProviders = { NAVER: null, GOOGLE: null, KAKAO: null };
  mockAccount.connectedPlatforms = mockAccount.connectedPlatforms.map((p) => ({ ...p, handle: null }));
  // Revoke instead of deleting the cookie, so the page keeps showing the 탈퇴 완료 state.
  await revokeSession();
  return { status: "WITHDRAWN" };
}
