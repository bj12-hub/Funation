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
  credentials: { password: string; recentPasswords: string[] };
  changeHistory: { nicknameChangedAt: Date | null; funationIdChangedAt: Date | null };
  /** Server-side revocation (e.g. after a password change); cleared on the next login. */
  session: { revoked: boolean };
};

const globalForMock = globalThis as typeof globalThis & { __funationMockState?: MockState };

const state = (globalForMock.__funationMockState ??= {
  account: {
    nickname: "홍길동",
    funationId: "hongGD123",
    avatarUrl: "/mock/account/avatar.png",
    linkedLoginProviders: { NAVER: false, GOOGLE: true, KAKAO: true },
    identityVerified: false,
    fnBalance: 5_000,
    rankingVisibility: { quest: true, luckyBox: true, play: false },
    connectedPlatforms: [
      { platform: "YOUTUBE", handle: "hongGD_tube" },
      { platform: "FLEXTV", handle: null },
      { platform: "SOOP", handle: null }
    ],
    marketingConsent: false
  },
  // The login mock accepts this password; a password change updates it.
  credentials: { password: "password", recentPasswords: ["password"] },
  changeHistory: { nicknameChangedAt: null, funationIdChangedAt: null },
  session: { revoked: false }
});

// Fields added after a dev server started are filled in on hot reload.
state.session ??= { revoked: false };

export const mockAccount = state.account;
export const mockCredentials = state.credentials;
export const mockChangeHistory = state.changeHistory;
export const mockSessionState = state.session;

// Sample values from the Figma error states (747:74, 747:120, 747:349, 747:394).
export const MOCK_TAKEN_NICKNAMES = ["funation"];
export const MOCK_TAKEN_FUNATION_IDS = ["funation"];
export const MOCK_FORBIDDEN_WORDS = ["운영자", "admin"];
