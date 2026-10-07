import type { Role } from "@/types/role";
import type { MyAccount } from "./myAccount";

/**
 * Development-only, in-memory account data shared by the session, login and account mocks.
 * Server-side only; values reset when the dev server restarts. Delete once the backend exists.
 *
 * Next.js can load this module more than once (Server Components and Server Actions are bundled
 * separately), so the state lives on `globalThis` to keep a single copy per server process.
 */

type MockState = {
  account: MyAccount;
  /**
   * `changedAt`: ISO time of the last password change (drives 718:335). `phone`: the number verified at sign-up
   * (password reset by phone; the person behind the account, see `currentPersonKey`) — never sent to the browser.
   */
  credentials: { password: string; recentPasswords: string[]; changedAt: string; phone: string };
  changeHistory: { nicknameChangedAt: Date | null; funationIdChangedAt: Date | null };
  /** Server-side revocation (e.g. after a password change); cleared on the next login. */
  session: { revoked: boolean; roles?: Role[] };
};

// Bump the key when the state shape changes so a running dev server starts from fresh data.
const globalForMock = globalThis as typeof globalThis & { __funationMockStateV4?: MockState };

const state = (globalForMock.__funationMockStateV4 ??= {
  account: {
    nickname: "홍길동",
    funationId: "hongGD123",
    avatarUrl: "/mock/account/avatar.png",
    // Figma 743:2203 / 743:2250 sample accounts (connected 2026. 09. 12 14:32 KST).
    linkedLoginProviders: {
      NAVER: null,
      GOOGLE: { identifier: "honggd@gmail.com", linkedAt: "2026-09-12T05:32:00.000Z" },
      KAKAO: { identifier: "honggd_kakao", linkedAt: "2026-09-12T05:32:00.000Z" }
    },
    identity: null,
    fnBalance: 5_000,
    rankingVisibility: { quest: true },
    connectedPlatforms: [
      { platform: "YOUTUBE", handle: "hongGD_tube" },
      { platform: "FLEXTV", handle: null },
      { platform: "SOOP", handle: null }
    ],
    marketingConsent: false
  },
  // The login mock accepts this password; a password change updates it.
  // Changed 7 months ago so the 비밀번호 변경 권유 screen (718:335) shows after login. The phone is a mock number.
  credentials: {
    password: "password",
    recentPasswords: ["password"],
    changedAt: new Date(Date.now() - 210 * 86_400_000).toISOString(),
    phone: "010-1234-5678"
  },
  changeHistory: { nicknameChangedAt: null, funationIdChangedAt: null },
  session: { revoked: false, roles: ["SUPPORTER", "CREATOR"] }
});

export const mockAccount = state.account;
export const mockCredentials = state.credentials;
export const mockChangeHistory = state.changeHistory;
export const mockSessionState = state.session;

/**
 * The person behind the signed-in mock account: the phone verified at sign-up. Today's 출석, 이벤트 참여 and 투표
 * count once per person by it (2026-10-08 결정), so a 재가입 with the same phone is the same person and one with
 * another phone is someone else. Server-only: it never goes into a response.
 */
export const currentPersonKey = () => state.credentials.phone;

// Sample values from the Figma error states (747:74, 747:120, 747:349, 747:394).
export const MOCK_TAKEN_NICKNAMES = ["funation"];
export const MOCK_TAKEN_FUNATION_IDS = ["funation"];
export const MOCK_FORBIDDEN_WORDS = ["운영자", "admin"];
