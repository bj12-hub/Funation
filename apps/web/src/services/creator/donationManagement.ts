"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import {
  BANNED_WORDS_MAX,
  BANNED_WORD_MAX,
  LIST_KINDS,
  LIST_PAGE_SIZE,
  LIST_QUERY_MAX,
  ONE_LINE_MESSAGE_MAX,
  PAGE_OPTIONS,
  QUEST_STATUSES,
  RANK_PERIODS,
  REPLACEMENT_MESSAGE_MAX,
  isValidSlug,
  type DonationPageSettings,
  type DonorRanking,
  type ListKind,
  type ListPeriod,
  type ManagementSaveResult,
  type PageOptionKey,
  type QuestStatus,
  type RankPeriod,
  type ReceivedDonation,
  type ReceivedDonationPage,
  type SlugCheckResult,
  type StatusFilter
} from "./donationManagementTypes";
import { mockCreator } from "./mockCreatorStore";

/**
 * 후원관리+ (route `/creator/donations`). Server Actions re-check the session and validate input.
 * Amounts are FN recorded by the server; the browser only formats them.
 * TBD: creator role check, who decides a quest's outcome and what happens to funds on 실패,
 * ranking point / success-rate formulas, audit of setting changes.
 */

type MockManagement = Omit<DonationPageSettings, "donateUrlBase" | "slug">;

const globalForMgmt = globalThis as typeof globalThis & { __funationMockDonationMgmt?: MockManagement };
const store = (globalForMgmt.__funationMockDonationMgmt ??= {
  oneLineMessage: "제 방송을 시청해주셔서 감사합니다.",
  options: { rankPublic: false, historyPublic: true, nicknameChangeable: true, customSoundPublic: false },
  replacement: { applyToNickname: false, applyToText: true, bannedWords: ["클리어"], message: "" }
});

/** Addresses already used by other creators (mock). */
const TAKEN_SLUGS = ["taen", "boharium", "seran", "admin", "funation", "donate", "creator"];
const DONATE_BASE = "https://funation.com/donate/";

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Donation management API is not connected yet.");
};

// ── 후원 페이지 설정 ───────────────────────────────────────────────────────────

export async function getDonationPageSettings(): Promise<DonationPageSettings | null> {
  assertMock();
  if (!(await getSession())) return null;
  await mockDelay(250);
  return { donateUrlBase: DONATE_BASE, slug: mockCreator.handle, ...structuredClone(store) };
}

export async function checkDonationSlug(slug: unknown): Promise<SlugCheckResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (typeof slug !== "string" || !isValidSlug(slug)) return { status: "INVALID", message: "3~20자의 영문 소문자, 숫자, _만 사용할 수 있어요." };
  await mockDelay(300);
  if (slug === mockCreator.handle) return { status: "SAME" };
  return { status: TAKEN_SLUGS.includes(slug) ? "TAKEN" : "AVAILABLE" };
}

/** Re-checks availability; the old address stops working (redirect policy TBD). */
export async function changeDonationSlug(slug: unknown): Promise<ManagementSaveResult> {
  const check = await checkDonationSlug(slug);
  if (check.status === "UNAUTHORIZED") return check;
  if (check.status === "INVALID") return check;
  if (check.status === "TAKEN") return { status: "INVALID", message: "이미 사용 중인 주소입니다." };
  await mockDelay(300);
  mockCreator.handle = slug as string;
  return { status: "SAVED" };
}

export async function saveOneLineMessage(message: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (typeof message !== "string" || message.trim().length > ONE_LINE_MESSAGE_MAX) return { status: "INVALID", message: `한 줄 메시지는 ${ONE_LINE_MESSAGE_MAX}자 이내로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => message.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  await mockDelay(300);
  store.oneLineMessage = message.trim();
  return { status: "SAVED" };
}

export async function setPageOption(key: unknown, value: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!PAGE_OPTIONS.some((o) => o.key === key) || typeof value !== "boolean") return { status: "INVALID", message: "설정 값을 확인해 주세요." };
  await mockDelay(250);
  store.options[key as PageOptionKey] = value;
  return { status: "SAVED" };
}

export async function setReplacementTarget(target: unknown, value: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if ((target !== "nickname" && target !== "text") || typeof value !== "boolean") return { status: "INVALID", message: "설정 값을 확인해 주세요." };
  await mockDelay(250);
  if (target === "nickname") store.replacement.applyToNickname = value;
  else store.replacement.applyToText = value;
  return { status: "SAVED" };
}

export async function addBannedWord(word: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const w = typeof word === "string" ? word.trim() : "";
  if (w.length < 1 || w.length > BANNED_WORD_MAX) return { status: "INVALID", message: `금지어는 1~${BANNED_WORD_MAX}자로 입력해 주세요.` };
  if (store.replacement.bannedWords.includes(w)) return { status: "INVALID", message: "이미 등록된 금지어입니다." };
  if (store.replacement.bannedWords.length >= BANNED_WORDS_MAX) return { status: "INVALID", message: `금지어는 최대 ${BANNED_WORDS_MAX}개까지 등록할 수 있어요.` };
  await mockDelay(250);
  store.replacement.bannedWords = [...store.replacement.bannedWords, w];
  return { status: "SAVED" };
}

/** Idempotent: removing a word that is already gone is not an error. */
export async function removeBannedWord(word: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(200);
  store.replacement.bannedWords = store.replacement.bannedWords.filter((w) => w !== word);
  return { status: "SAVED" };
}

export async function saveReplacementMessage(message: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (typeof message !== "string" || message.trim().length > REPLACEMENT_MESSAGE_MAX) {
    return { status: "INVALID", message: `대체 메시지는 ${REPLACEMENT_MESSAGE_MAX}자 이내로 입력해 주세요.` };
  }
  await mockDelay(250);
  store.replacement.message = message.trim();
  return { status: "SAVED" };
}

// ── 후원 리스트 ────────────────────────────────────────────────────────────────

const DONORS: [string, string][] = [
  ["우주비행사", "space_runner"],
  ["행복한하루", "happy_day"],
  ["보해매니아", "bohae_fan"],
  ["초코쿠키", "choco_pie"],
  ["별빛소나타", "star_sonata"],
  ["치즈냥", "cheese_cat"],
  ["노을지기", "sunset_keeper"],
  ["코코넛", "coconut99"]
];
const MESSAGES = [
  "이번 퀘스트 꼭 클리어해주세요 화이팅!!",
  "리액션이 아주 귀여우시네요 ㅋㅋㅋ",
  "오늘 방송 꿀잼 보장 퀘스트",
  "저녁 식사 미션입니다.",
  "노래 한 곡 불러주세요!",
  "보스 노데스 클리어 도전",
  "랜덤 뽑기 3번 연속 성공하기",
  "시청자 이름 불러주기"
];
const STATUS_CYCLE: QuestStatus[] = ["SUCCESS", "SUCCESS", "FAILED"];
const AMOUNTS = [50_000, 10_000, 100_000, 5_000, 3_000, 20_000, 30_000, 7_000];

/** 36 quest donations spread over ~14 months ending now (deterministic mock). */
function mockQuestDonations(): ReceivedDonation[] {
  const now = Date.now();
  return Array.from({ length: 36 }, (_, i) => {
    const [nick, id] = DONORS[i % DONORS.length];
    const at = new Date(now - Math.round(i * i * 0.35 * 86_400_000 + i * 3_700_000));
    // Only the most recent quest is still running.
    const status: QuestStatus = i === 1 ? "IN_PROGRESS" : STATUS_CYCLE[i % STATUS_CYCLE.length];
    return { id: `q${i + 1}`, at: at.toISOString(), donorNickname: nick, donorId: id, amount: AMOUNTS[i % AMOUNTS.length], message: MESSAGES[i % MESSAGES.length], status };
  });
}

export async function getReceivedDonations(input: { kind: ListKind; period: ListPeriod; status: StatusFilter; query: string; page: number }): Promise<ReceivedDonationPage | null> {
  assertMock();
  if (!(await getSession())) return null;
  await mockDelay(300);
  const kind = LIST_KINDS.some((k) => k.key === input.kind) ? input.kind : "quest";
  const status: StatusFilter = input.status === "ALL" || QUEST_STATUSES.some((s) => s.key === input.status) ? input.status : "ALL";
  const query = input.query.trim().slice(0, LIST_QUERY_MAX).toLowerCase();
  // 게임 · 크루 lists are not designed yet: they return no rows.
  const all = kind === "quest" ? mockQuestDonations() : [];
  const years = [...new Set(all.map((d) => new Date(d.at).getFullYear()))].sort((a, b) => b - a);
  const localDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const matched = all.filter((d) => {
    const day = localDate(d.at);
    if (day < input.period.from || day > input.period.to) return false;
    if (status !== "ALL" && d.status !== status) return false;
    return !query || d.donorNickname.toLowerCase().includes(query) || d.donorId.toLowerCase().includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(matched.length / LIST_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(input.page) || 1), totalPages);
  return {
    kind,
    period: input.period,
    status,
    query: input.query.trim().slice(0, LIST_QUERY_MAX),
    page,
    totalPages,
    total: matched.length,
    items: matched.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE),
    years
  };
}

// ── 후원 순위 ─────────────────────────────────────────────────────────────────

const RANK_SEED: [string, number, number, number, number][] = [
  // nickname, change, points, count, successRate
  ["보해리움 Boharium", 1, 19_742, 954, 48],
  ["세란이(SERAN)", 0, 12_632, 49, 56],
  ["승냥이1", 134, 5_845, 147, 47],
  ["개그우현양기버", 0, 5_019, 116, 31],
  ["째이", -2, 4_677, 32, 19],
  ["우주비행사", 3, 3_904, 88, 62],
  ["행복한하루", -1, 3_120, 41, 44],
  ["보해매니아", 0, 2_880, 57, 39],
  ["초코쿠키", 5, 2_415, 23, 35],
  ["별빛소나타", -4, 1_990, 19, 28]
];
const RANK_SCALE: Record<RankPeriod, number> = { day: 0.04, week: 0.2, month: 0.55, season: 1 };

export async function getDonorRanking(period: RankPeriod): Promise<DonorRanking | null> {
  assertMock();
  if (!(await getSession())) return null;
  await mockDelay(300);
  const p = RANK_PERIODS.some((x) => x.key === period) ? period : "month";
  const scale = RANK_SCALE[p];
  const rows = RANK_SEED.map(([nickname, change, points, count, successRate], i) => ({
    rank: i + 1,
    change: p === "season" ? change : Math.trunc(change / 2),
    nickname,
    avatarUrl: `/mock/hall-of-fame/supporter-${i + 1}.png`,
    points: Math.round(points * scale),
    count: Math.max(1, Math.round(count * scale)),
    successRate
  }));
  const first = rows[0];
  return {
    period: p,
    rows,
    top: first
      ? { nickname: "Boharium", avatarUrl: first.avatarUrl, rank: 1, change: 2, points: first.points, totalAmount: Math.round(2_580_000 * scale), count: Math.max(1, Math.round(154 * scale)) }
      : null
  };
}
