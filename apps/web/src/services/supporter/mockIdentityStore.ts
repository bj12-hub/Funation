import type { EquipSettings } from "./identityTypes";

/**
 * Development-only supporter identity state. Server-side only, kept on `globalThis` like the other
 * mock stores. Donations are attributed to a nickname through `attribution`; donations without an
 * entry (the member nickname, seed history, older records) belong to the 기본 별명 (`nk-default`).
 */

type MockIdentity = {
  nicknames: { id: string; name: string }[];
  defaultId: string;
  equip: EquipSettings;
  /** donation record id → nickname id */
  attribution: Record<string, string>;
};

// V2 (2026-10-08 누적 등급): an equipped title from the old ladder ("GOLD" …) no longer exists, so a running dev
// server starts from fresh settings instead of resolving a missing title.
const g = globalThis as typeof globalThis & { __ssumnationMockIdentityV2?: MockIdentity };

const initial = (): MockIdentity => ({
  nicknames: [],
  defaultId: "nk-default",
  equip: { showGrade: true, globalTitle: "AUTO", showStoreTitle: true },
  attribution: {}
});

export const mockIdentity = (g.__ssumnationMockIdentityV2 ??= initial());

/** 재가입 (services/account/rejoin.ts): the new account starts without the withdrawn one's 별명, 대표 and 칭호 settings. */
export const resetMockIdentity = () => Object.assign(mockIdentity, initial());
