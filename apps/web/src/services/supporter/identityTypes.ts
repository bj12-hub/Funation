/**
 * Supporter identity (후원자 정체성) — code-first, no Figma frame yet (docs/figma/code-first-screens.md).
 * Donation nicknames, the 6-month 활동 등급, the lifetime 누적 등급 (global titles) and per-creator titles, as reference ideas
 * from docs/research/funnation-reference.md.
 *
 * The grade and title names and when they rise or fall follow the 2026-10-08 structure below; every FN threshold
 * here is still a **placeholder** (CLAUDE.md §14), and so are the creator titles and the nickname limit (TBD).
 * The server computes all of them from donation records; the browser only displays them.
 */

export const MAX_NICKNAMES = 5;
export const NICKNAME_RULE = /^[가-힣A-Za-z0-9_]{2,12}$/;
/** What a donation sent with 프로필 숨기기 shows as its name; reserved, so no 별명 or nickname can pose as it. */
export const HIDDEN_PROFILE_LABEL = "익명";
export const isReservedNickname = (name: string) => name.trim() === HIDDEN_PROFILE_LABEL;

/*
 * 등급 구조 (2026-10-08, FLEXTV 회원 등급 개편안을 그대로 적용): 누적 등급 12단계(다이아 6 · 블랙 6, 내려가지 않음)와
 * 최근 6개월 활동 등급 5단계. 기준 FN은 개편안의 렉스 숫자를 그대로 쓴 임시 값 — FN 환율이 TBD라 원화 기준은 아직 없다.
 */

/** 활동 등급 기간: 이번 달을 포함한 최근 6개월(달력 기준, 한국 시간). */
export const GRADE_MONTHS = 6;

/**
 * 최근 6개월 후원 FN으로 정하는 활동 등급 (placeholder thresholds, TBD). 기준을 넘으면 바로 오르고, 매월 1일에 지난
 * 6개월 후원으로 다시 정한다 — 그 달에는 다시 정한 등급 아래로 내려가지 않는다.
 */
export const GRADES = [
  { key: "BASIC", label: "일반", minFn: 0 },
  { key: "SILVER", label: "실버", minFn: 30_000 },
  { key: "GOLD", label: "골드", minFn: 60_000 },
  { key: "PLATINUM", label: "플래티넘", minFn: 100_000 },
  { key: "MASTER", label: "마스터", minFn: 200_000 },
  { key: "LEGEND", label: "레전드", minFn: 500_000 }
] as const;
export type GradeKey = (typeof GRADES)[number]["key"];

export type TitleLine = "DIAMOND" | "BLACK";
export const TITLE_LINE_LABEL: Record<TitleLine, string> = { DIAMOND: "다이아 등급", BLACK: "블랙 등급" };

/** 누적 후원 FN으로 얻는 누적 등급(글로벌 칭호) — 한 번 얻으면 내려가지 않는다 (placeholder thresholds, TBD). */
export const GLOBAL_TITLES = [
  { key: "DIAMOND", line: "DIAMOND", label: "다이아", minFn: 500_000 },
  { key: "BLUE_DIAMOND", line: "DIAMOND", label: "블루 다이아", minFn: 700_000 },
  { key: "GREEN_DIAMOND", line: "DIAMOND", label: "그린 다이아", minFn: 1_000_000 },
  { key: "RED_DIAMOND", line: "DIAMOND", label: "레드 다이아", minFn: 1_500_000 },
  { key: "PURPLE_DIAMOND", line: "DIAMOND", label: "퍼플 다이아", minFn: 2_200_000 },
  { key: "RAINBOW_DIAMOND", line: "DIAMOND", label: "레인보우 다이아", minFn: 3_300_000 },
  { key: "BLACK_1", line: "BLACK", label: "블랙 1성", minFn: 5_000_000 },
  { key: "BLACK_2", line: "BLACK", label: "블랙 2성", minFn: 6_500_000 },
  { key: "BLACK_3", line: "BLACK", label: "블랙 3성", minFn: 8_000_000 },
  { key: "BLACK_4", line: "BLACK", label: "블랙 4성", minFn: 10_000_000 },
  { key: "BLACK_5", line: "BLACK", label: "블랙 5성", minFn: 12_500_000 },
  { key: "BLACK_6", line: "BLACK", label: "블랙 6성", minFn: 15_000_000 }
] as const satisfies readonly { key: string; line: TitleLine; label: string; minFn: number }[];
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
  /**
   * `recentFn`: this month and the five before. `kept`: the grade comes from the six full months before this month
   * (매월 1일 재산정) and stays until the month ends, although `recentFn` alone is below it.
   */
  grade: { key: GradeKey; recentFn: number; kept: boolean; progress: Progress };
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
/** 일반 is the base: it is never shown as a badge. */
export const hasGrade = (k: GradeKey) => k !== "BASIC";
export const globalTitleLabel = (k: GlobalTitleKey) => GLOBAL_TITLES.find((t) => t.key === k)!.label;
export const storeTitleLabel = (k: StoreTitleKey) => STORE_TITLES.find((t) => t.key === k)!.label;
