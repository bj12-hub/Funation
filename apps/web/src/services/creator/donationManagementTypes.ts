/**
 * 후원관리+ — Figma 539:7 (후원 페이지 설정) · 539:156 (후원 리스트) · 539:303 (후원 순위) ·
 * 539:466 / 539:574 (후원 필터링) · 539:690 (칭호 설정). Route `/creator/donations?tab=`.
 * Client-safe types and option lists; the actions live in ./donationManagement.ts.
 */

import { isIsoDate, toDateString } from "@/lib/period";

export const MANAGEMENT_TABS = [
  { key: "settings", label: "후원 페이지 설정" },
  { key: "list", label: "후원 리스트" },
  { key: "ranking", label: "후원 순위" },
  { key: "filtering", label: "후원 필터링" },
  { key: "titles", label: "칭호 설정" }
] as const;
export type ManagementTab = (typeof MANAGEMENT_TABS)[number]["key"];
export const parseManagementTab = (v: string | undefined): ManagementTab =>
  MANAGEMENT_TABS.some((t) => t.key === v) ? (v as ManagementTab) : "settings";

// ── 후원 페이지 설정 (539:7) ─────────────────────────────────────────────────────

export const PAGE_OPTIONS = [
  { key: "rankPublic", label: "후원순위 공개", on: "공개", off: "비공개", help: "후원 페이지에 후원 순위를 보여줄지 정합니다." },
  { key: "historyPublic", label: "받은 후원 내역 공개", on: "공개", off: "비공개", help: "후원 페이지에 받은 후원 내역을 보여줄지 정합니다." },
  { key: "nicknameChangeable", label: "후원 닉네임 변경", on: "변경 가능", off: "변경 불가", help: "도네이터가 후원할 때 표시될 닉네임을 바꿀 수 있는지 정합니다." },
  { key: "customSoundPublic", label: "커스텀 사운드 공개", on: "공개", off: "비공개", help: "등록한 커스텀 사운드 단어 목록을 후원 페이지에 보여줄지 정합니다." }
] as const;
export type PageOptionKey = (typeof PAGE_OPTIONS)[number]["key"];

export const ONE_LINE_MESSAGE_MAX = 50;
export const BANNED_WORD_MAX = 20;
export const BANNED_WORDS_MAX = 50;
export const REPLACEMENT_MESSAGE_MAX = 50;
/** Donation page address rule — assumption: 3–20 lowercase letters, digits or _ (TBD). */
export const isValidSlug = (v: string) => /^[a-z0-9_]{3,20}$/.test(v);

export type DonationPageSettings = {
  donateUrlBase: string;
  slug: string;
  oneLineMessage: string;
  options: Record<PageOptionKey, boolean>;
  replacement: { applyToNickname: boolean; applyToText: boolean; bannedWords: string[]; message: string };
};

export type SlugCheckResult = { status: "AVAILABLE" | "TAKEN" | "SAME" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
export type ManagementSaveResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

// ── 후원 리스트 (539:156) ────────────────────────────────────────────────────────

/** `column`: the last column of each list (게임 · 크루 are code-first, no Figma frame). */
export const LIST_KINDS = [
  { key: "quest", label: "퀘스트 후원", column: "퀘스트 상태" },
  { key: "game", label: "게임 후원", column: "게임 종류" },
  { key: "crew", label: "크루 후원", column: "멤버" }
] as const;
export type ListKind = (typeof LIST_KINDS)[number]["key"];

export const LIST_PERIODS = [
  { key: "today", label: "오늘" },
  { key: "1w", label: "1주일" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "6m", label: "6개월" },
  { key: "1y", label: "1년" }
] as const;
export type ListPeriodPreset = (typeof LIST_PERIODS)[number]["key"] | "year" | "range";

import type { QuestAction } from "@/services/donations/questTypes";

export const QUEST_STATUSES = [
  { key: "SUCCESS", label: "성공" },
  { key: "IN_PROGRESS", label: "진행중" },
  // A failed or cancelled quest refunds the whole amount (2026-10-04 결정).
  { key: "FAILED", label: "실패 · 환불" },
  { key: "CANCELED", label: "취소 · 환불" }
] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number]["key"];
export type StatusFilter = QuestStatus | "ALL";

export const LIST_PAGE_SIZE = 10;
export const LIST_QUERY_MAX = 20;

export type ListPeriod = { preset: ListPeriodPreset; from: string; to: string; year?: number };

export type ReceivedDonation = {
  id: string;
  at: string;
  donorNickname: string;
  donorId: string;
  /** FN, as recorded by the server. */
  amount: number;
  message: string;
  /** 퀘스트 후원 only. */
  status: QuestStatus | null;
  /** 게임 후원: the game (룰렛 후원 · 뽑기 후원) · 크루 후원: the member it was sent for. */
  detail: string | null;
  /** 퀘스트 후원: what the creator can do with this running quest now (성공 · 실패 only with 크리에이터 성공 결정; 취소 always). */
  questActions?: QuestAction[];
};

export type ReceivedDonationPage = {
  kind: ListKind;
  period: ListPeriod;
  status: StatusFilter;
  query: string;
  page: number;
  totalPages: number;
  total: number;
  items: ReceivedDonation[];
  /** Years that have data, for 연도 선택. */
  years: number[];
};

const shift = (d: Date, months: number, days = 0) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() - months);
  x.setDate(x.getDate() - days + (months || days ? 1 : 0));
  return x;
};

/** Validates list URL params (default 1년 as in the design). */
export function parseListPeriod(raw: { period?: string; from?: string; to?: string; year?: string }, today = new Date()): ListPeriod {
  const to = toDateString(today);
  switch (raw.period) {
    case "today":
      return { preset: "today", from: to, to };
    case "1w":
      return { preset: "1w", from: toDateString(shift(today, 0, 7)), to };
    case "1m":
    case "3m":
    case "6m":
      return { preset: raw.period, from: toDateString(shift(today, Number(raw.period[0]))), to };
    case "year": {
      const y = Number(raw.year);
      if (Number.isInteger(y) && y >= 2000 && y <= today.getFullYear()) return { preset: "year", year: y, from: `${y}-01-01`, to: `${y}-12-31` };
      break;
    }
    case "range": {
      if (isIsoDate(raw.from) && isIsoDate(raw.to) && raw.from <= raw.to) return { preset: "range", from: raw.from!, to: raw.to! };
      break;
    }
  }
  return { preset: "1y", from: toDateString(shift(today, 12)), to };
}

// ── 후원 순위 (539:303) ─────────────────────────────────────────────────────────

export const RANK_PERIODS = [
  { key: "day", label: "일간" },
  { key: "week", label: "주간" },
  { key: "month", label: "월간" },
  { key: "season", label: "시즌" }
] as const;
export type RankPeriod = (typeof RANK_PERIODS)[number]["key"];

export type DonorRankRow = {
  rank: number;
  change: number;
  nickname: string;
  avatarUrl: string | null;
  points: number;
  count: number;
  /** Share of successful quest/game donations, whole percent. Definition TBD. */
  successRate: number;
};

export type DonorRanking = {
  period: RankPeriod;
  rows: DonorRankRow[];
  /** Summary card: the top supporter for the period. */
  top: { nickname: string; avatarUrl: string | null; rank: number; change: number; points: number; totalAmount: number; count: number } | null;
};

// ── 후원 필터링 (539:466 · 539:574) ─────────────────────────────────────────────

export const FILTER_SUBTABS = [
  { key: "filter", label: "필터링" },
  { key: "block", label: "차단 리스트" }
] as const;
export type FilterSubtab = (typeof FILTER_SUBTABS)[number]["key"];

export const FILTER_STRENGTHS = [
  { key: "HIGH", label: "매우 높음" },
  { key: "NORMAL", label: "보통" },
  { key: "OFF", label: "사용 안 함" }
] as const;
export type FilterStrength = (typeof FILTER_STRENGTHS)[number]["key"];
export const FILTER_WORD_MAX = 20;
export const FILTER_WORDS_MAX = 100;

export type FilterSettings = { strength: FilterStrength; blockSpam: boolean; words: string[] };

/** Confirmed platforms (the design's 아프리카TV sample is SOOP; 치지직 is confirmed since 2026-10-01). */
export const BLOCK_PLATFORM_LABEL = { YOUTUBE: "YouTube", FLEXTV: "FlexTV", SOOP: "SOOP", CHZZK: "치지직", FUNATION: "Somnation" } as const;
export type BlockPlatform = keyof typeof BLOCK_PLATFORM_LABEL;

export type BlockedDonor = { id: string; blockedAt: string; donorId: string; nickname: string; platform: BlockPlatform; reason: string };
export const BLOCK_PAGE_SIZE = 10;
export type BlockedDonorPage = { query: string; page: number; totalPages: number; total: number; items: BlockedDonor[] };

// ── 칭호 설정 (539:690) ─────────────────────────────────────────────────────────

/** Cumulative-FN thresholds shown in the design (whether creators can edit them is TBD). */
export const TITLE_TIERS = [900_000_000, 800_000_000, 700_000_000, 600_000_000, 500_000_000, 400_000_000, 300_000_000, 200_000_000, 100_000_000, 70_000_000, 50_000_000, 30_000_000] as const;
export const TITLE_NAME_MAX = 8;
export const TITLE_DESCRIPTION_MAX = 40;

export type TitleTier = {
  threshold: number;
  enabled: boolean;
  name: string;
  description: string;
  iconUrl: string | null;
  color: string;
};

export type TitleSaveResult = { status: "SAVED"; tier: TitleTier } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

// ── 후원 리스트 CSV (code-first) ──────────────────────────────────────────────

export const CSV_EXPORT_MAX = 5_000;

export type CsvExportResult =
  | { status: "OK"; filename: string; csv: string; rows: number; truncated: boolean }
  | { status: "INVALID" }
  | { status: "UNAUTHORIZED" };
