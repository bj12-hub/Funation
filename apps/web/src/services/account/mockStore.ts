import type { MyAccount } from "./myAccount";

/**
 * Development-only, in-memory account data shared by the session, login and account mocks.
 * Server-side only; values reset when the dev server restarts. Delete once the backend exists.
 */

export const mockAccount: MyAccount = {
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
};

/** The login mock accepts this password; a password change updates it. */
export const mockCredentials = {
  password: "password",
  recentPasswords: ["password"]
};

export const mockChangeHistory: { nicknameChangedAt: Date | null; funationIdChangedAt: Date | null } = {
  nicknameChangedAt: null,
  funationIdChangedAt: null
};

// Sample values from the Figma error states (747:74, 747:120, 747:349, 747:394).
export const MOCK_TAKEN_NICKNAMES = ["funation"];
export const MOCK_TAKEN_FUNATION_IDS = ["funation"];
export const MOCK_FORBIDDEN_WORDS = ["운영자", "admin"];
