/**
 * Supporter identity (후원자 정체성) — code-first, no Figma frame yet (docs/figma/code-first-screens.md).
 * Donation nicknames, the 30-day grade, lifetime titles and per-creator titles, as reference ideas
 * from docs/research/funnation-reference.md.
 *
 * Every threshold here is a **placeholder** (CLAUDE.md §14): grade and title rules, their names,
 * whether they decay, and the nickname limit are product decisions that are not made yet (TBD).
 * The server computes all of them from donation records; the browser only displays them.
 */

export const MAX_NICKNAMES = 5;
export const NICKNAME_RULE = /^[가-힣A-Za-z0-9_]{2,12}$/;
/** What a donation sent with 프로필 숨기기 shows as its name; reserved, so no 별명 or nickname can pose as it. */
export const HIDDEN_PROFILE_LABEL = "익명";
export const isReservedNickname = (name: string) => name.trim() === HIDDEN_PROFILE_LABEL;

/** 최근 30일 후원 FN으로 정하는 등급 (placeholder thresholds, TBD). */
export const GRADES = [
  { key: "FRIEND", label: "프렌드", minFn: 0 },
  { key: "VIP", label: "VIP", minFn: 100_000 },
  { key: "VVIP", label: "VVIP", minFn: 500_000 },
  { key: "SVIP", label: "SVIP", minFn: 1_000_000 }
] as const;
export type GradeKey = (typeof GRADES)[number]["key"];

/** 누적 후원 FN으로 얻는 글로벌 칭호 (placeholder names and thresholds, TBD). */
export const GLOBAL_TITLES = [
  { key: "BRONZE", label: "브론즈 서포터", minFn: 10_000 },
  { key: "SILVER", label: "실버 서포터", minFn: 50_000 },
  { key: "GOLD", label: "골드 서포터", minFn: 100_000 },
  { key: "PLATINUM", label: "플래티넘 서포터", minFn: 300_000 },
  { key: "DIAMOND", label: "다이아 서포터", minFn: 1_000_000 },
  { key: "MASTER", label: "마스터 서포터", minFn: 3_000_000 },
  { key: "LEGEND", label: "레전드 서포터", minFn: 10_000_000 }
] as const;
export type GlobalTitleKey = (typeof GLOBAL_TITLES)[number]["key"];

/** 크리에이터별(스토어) 칭호 — per-creator cumulative FN (placeholder template, TBD per creator). */
export const STORE_TITLES = [
  { key: "FAN", label: "새싹 팬", minFn: 5_000 },
  { key: "HOT", label: "열혈 팬", minFn: 30_000 },
  { key: "TRUE", label: "찐팬", minFn: 100_000 },
  { key: "CROWN", label: "왕관 팬", minFn: 500_000 }
] as const;
export type StoreTitleKey = (typeof STORE_TITLES)[number]["key"];

export type DonationNickname = { id: string; name: string; isDefault: boolean; totalFn: number; count: number };

export type Progress = { currentFn: number; nextLabel: string | null; nextMinFn: number | null; percent: number };

export type EquipSettings = {
  showGrade: boolean;
  /** "AUTO" = highest earned, "OFF" = hidden, otherwise a collected title key. */
  globalTitle: "AUTO" | "OFF" | GlobalTitleKey;
  showStoreTitle: boolean;
};

export type StoreTitleRow = { creatorId: string; creatorName: string; totalFn: number; title: StoreTitleKey | null; progress: Progress };

export type SupporterIdentity = {
  nicknames: DonationNickname[];
  grade: { key: GradeKey; last30Fn: number; progress: Progress };
  global: { lifetimeFn: number; earned: GlobalTitleKey[]; best: GlobalTitleKey | null; progress: Progress };
  stores: StoreTitleRow[];
  equip: EquipSettings;
};

export type IdentitySaveResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** What a donation alert shows for this supporter (server-resolved). */
export type AlertBadges = { name: string; grade: string | null; globalTitle: string | null; storeTitle: string | null };

/** Badge labels in the order an alert shows them (grade → global title → creator title). */
export const alertBadgeLabels = (b: AlertBadges) => [b.grade, b.globalTitle, b.storeTitle].filter((x): x is string => x !== null);

export const gradeLabel = (k: GradeKey) => GRADES.find((g) => g.key === k)!.label;
export const globalTitleLabel = (k: GlobalTitleKey) => GLOBAL_TITLES.find((t) => t.key === k)!.label;
export const storeTitleLabel = (k: StoreTitleKey) => STORE_TITLES.find((t) => t.key === k)!.label;
