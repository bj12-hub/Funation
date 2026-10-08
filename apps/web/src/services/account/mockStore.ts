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
   * (password reset by phone). `personKey`: the person behind the account (`currentPersonKey`), an opaque id that a
   * 재가입 with the same phone takes over while the withdrawn account's 본인 확인 값 is kept. Neither is sent to the
   * browser; a withdrawal clears both (its record keeps the key with a hash of the phone, ./withdrawalCore.ts).
   */
  credentials: { password: string; recentPasswords: string[]; changedAt: string; phone: string; personKey: string };
  changeHistory: { nicknameChangedAt: Date | null; funationIdChangedAt: Date | null };
  /** Server-side revocation (e.g. after a password change); cleared on the next login. */
  session: { revoked: boolean; roles?: Role[] };
};

// Bump the key when the state shape changes so a running dev server starts from fresh data.
// V5: credentials carry the person key (it was the phone itself).
const globalForMock = globalThis as typeof globalThis & { __funationMockStateV5?: MockState };

const state = (globalForMock.__funationMockStateV5 ??= {
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
    phone: "010-1234-5678",
    // Web Crypto (not node:crypto): this module is also bundled for the browser through shared helpers.
    personKey: globalThis.crypto.randomUUID()
  },
  changeHistory: { nicknameChangedAt: null, funationIdChangedAt: null },
  session: { revoked: false, roles: ["SUPPORTER", "CREATOR"] }
});

export const mockAccount = state.account;
export const mockCredentials = state.credentials;
export const mockChangeHistory = state.changeHistory;
export const mockSessionState = state.session;

/**
 * The person behind the signed-in mock account, known by the phone verified at sign-up. Today's 출석, 이벤트 참여 and
 * 투표 count once per person by it, and so do the 룰렛 · 뽑기 daily limits (2026-10-08 결정): a 재가입 with the same
 * phone is the same person and one with another phone is someone else — while the withdrawn account's 본인 확인 값
 * is kept (1 year, retentionPolicy.ts PERSON_KEY). After that the same phone starts a new person (./rejoin.ts).
 * Server-only: it never goes into a response.
 */
export const currentPersonKey = () => state.credentials.personKey;

// Sample values from the Figma error states (747:74, 747:120, 747:349, 747:394).
export const MOCK_TAKEN_NICKNAMES = ["funation"];
export const MOCK_TAKEN_FUNATION_IDS = ["funation"];
export const MOCK_FORBIDDEN_WORDS = ["운영자", "admin"];
