"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession, hasRole, revokeSession } from "@/lib/session";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { mockAccount, mockCredentials } from "./mockStore";
import { withdrawalOf, withdrawalStore } from "./withdrawalCore";
import type { WithdrawResult, WithdrawalInfo } from "./withdrawalTypes";

/**
 * 회원 탈퇴 — code-first, route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05:
 * 크리에이터 정산 대기 수익도 소멸 동의, 탈퇴 직전 비밀번호 재입력). The server re-checks the session, every consent
 * and the password, forfeits exactly the amounts the member saw, and ends the session. One request id per intended
 * withdrawal, so a retry after a lost response gets the same answer. Rate limiting of password attempts belongs to
 * the backend; accounts that only use social login re-confirm with that login (provider hand-off TBD).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Withdrawal API is not connected yet.");
};

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

/** Creator earnings not paid out yet: 정산 가능 FN + 정산 신청 중. */
const unsettledFn = () => mockSettlement.availableFn + mockSettlement.requests.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amountFn, 0);

export async function getWithdrawalInfo(): Promise<WithdrawalInfo | null> {
  assertMock();
  const session = await getSession();
  if (!session) return null;
  await mockDelay(200);
  const creator = hasRole(session, "CREATOR");
  return { nickname: mockAccount.nickname, fnBalance: mockAccount.fnBalance, creator, unsettledFn: creator ? unsettledFn() : 0 };
}

export async function withdrawAccount(input: unknown): Promise<WithdrawResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "요청을 확인해 주세요." };
  // The same request again (e.g. the response was lost): it already went through, and the session is gone.
  if (withdrawalOf()?.requestId === v.requestId) return { status: "WITHDRAWN" };
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (v.confirmed !== true) return { status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." };
  const balance = mockAccount.fnBalance;
  const earnings = hasRole(session, "CREATOR") ? unsettledFn() : 0;
  // The consents cover the amounts the member saw; amounts that changed since need a new look.
  if (v.fnBalance !== balance) return { status: "INVALID", message: "남은 FN이 바뀌었어요. 금액을 다시 확인해 주세요." };
  if ((v.unsettledFn ?? 0) !== earnings) return { status: "INVALID", message: "정산 대기 수익이 바뀌었어요. 금액을 다시 확인해 주세요." };
  if (balance > 0 && v.forfeitAgreed !== true) return { status: "INVALID", message: "남은 FN 소멸에 동의해 주세요." };
  if (earnings > 0 && v.earningsForfeitAgreed !== true) return { status: "INVALID", message: "정산 대기 수익 소멸에 동의해 주세요." };
  await mockDelay(400);
  if (typeof v.password !== "string" || v.password !== mockCredentials.password) return { status: "WRONG_PASSWORD" };

  const now = new Date().toISOString();
  withdrawalStore().withdrawal = {
    at: now,
    requestId: v.requestId,
    forfeitedFn: balance,
    forfeitedEarningsFn: earnings,
    nickname: mockAccount.nickname,
    funationId: mockAccount.funationId
  };
  mockAccount.fnBalance = 0;
  mockAccount.linkedLoginProviders = { NAVER: null, GOOGLE: null, KAKAO: null };
  mockAccount.connectedPlatforms = mockAccount.connectedPlatforms.map((p) => ({ ...p, handle: null }));
  if (earnings > 0) {
    // 정산 가능 FN is gone, and requests still waiting for review end as 탈퇴 소멸 (not 반려 — nobody rejected them).
    mockSettlement.availableFn = 0;
    for (const r of mockSettlement.requests.filter((r) => r.status === "PENDING")) {
      Object.assign(r, { status: "FORFEITED", feeFn: 0, netKrw: 0, payoutDate: null, review: { at: now, by: "회원 탈퇴", note: "정산 대기 수익 소멸 (회원 동의)" } });
    }
  }
  // Revoke instead of deleting the cookie, so the page keeps showing the 탈퇴 완료 state.
  await revokeSession();
  return { status: "WITHDRAWN" };
}
