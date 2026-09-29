import type { EquipSettings } from "./identityTypes";

/**
 * Development-only supporter identity state. Server-side only, kept on `globalThis` like the other
 * mock stores. Donations are attributed to a nickname through `attribution`; donations without an
 * entry (seed history, older records) belong to the default nickname.
 */

type MockIdentity = {
  nicknames: { id: string; name: string }[];
  defaultId: string;
  equip: EquipSettings;
  /** donation record id → nickname id */
  attribution: Record<string, string>;
};

const g = globalThis as typeof globalThis & { __funationMockIdentityV1?: MockIdentity };

export const mockIdentity = (g.__funationMockIdentityV1 ??= {
  nicknames: [],
  defaultId: "nk-default",
  equip: { showGrade: true, globalTitle: "AUTO", showStoreTitle: true },
  attribution: {}
});
