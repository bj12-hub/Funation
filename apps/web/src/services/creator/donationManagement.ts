"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import {
  BLOCK_PAGE_SIZE,
  FILTER_STRENGTHS,
  FILTER_WORDS_MAX,
  FILTER_WORD_MAX,
  TITLE_DESCRIPTION_MAX,
  TITLE_NAME_MAX,
  TITLE_TIERS,
  type BlockPlatform,
  type BlockedDonor,
  type BlockedDonorPage,
  type FilterSettings,
  type FilterStrength,
  type TitleSaveResult,
  type TitleTier,
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
  type RankPeriod,
  type ReceivedDonation,
  type CsvExportResult,
  CSV_EXPORT_MAX,
  type ReceivedDonationPage,
  type SlugCheckResult,
  type StatusFilter
} from "./donationManagementTypes";
import { crewDonationRows } from "@/services/crew/crewCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { decideQuest, findQuest, mockQuests } from "@/services/donations/questCore";
import { isQuestAction, type QuestAction, type QuestDecideResult } from "@/services/donations/questTypes";
import { getDonationCatalog } from "@/services/donations/signatureCore";
import { FIXTURE_AMOUNTS, FIXTURE_DONORS } from "./receivedFixtures";
import { mockCreator } from "./mockCreatorStore";
import { isIsoDate } from "@/lib/period";

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
const DONATE_BASE = "https://somnation.com/donate/";

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Donation management API is not connected yet.");
};

// ── 후원 페이지 설정 ───────────────────────────────────────────────────────────

export async function getDonationPageSettings(): Promise<DonationPageSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(250);
  return { donateUrlBase: DONATE_BASE, slug: mockCreator.handle, ...structuredClone(store) };
}

export async function checkDonationSlug(slug: unknown): Promise<SlugCheckResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
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
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof message !== "string" || message.trim().length > ONE_LINE_MESSAGE_MAX) return { status: "INVALID", message: `한 줄 메시지는 ${ONE_LINE_MESSAGE_MAX}자 이내로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => message.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  await mockDelay(300);
  store.oneLineMessage = message.trim();
  return { status: "SAVED" };
}

export async function setPageOption(key: unknown, value: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!PAGE_OPTIONS.some((o) => o.key === key) || typeof value !== "boolean") return { status: "INVALID", message: "설정 값을 확인해 주세요." };
  await mockDelay(250);
  store.options[key as PageOptionKey] = value;
  return { status: "SAVED" };
}

export async function setReplacementTarget(target: unknown, value: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if ((target !== "nickname" && target !== "text") || typeof value !== "boolean") return { status: "INVALID", message: "설정 값을 확인해 주세요." };
  await mockDelay(250);
  if (target === "nickname") store.replacement.applyToNickname = value;
  else store.replacement.applyToText = value;
  return { status: "SAVED" };
}

export async function addBannedWord(word: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
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
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(200);
  store.replacement.bannedWords = store.replacement.bannedWords.filter((w) => w !== word);
  return { status: "SAVED" };
}

export async function saveReplacementMessage(message: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof message !== "string" || message.trim().length > REPLACEMENT_MESSAGE_MAX) {
    return { status: "INVALID", message: `대체 메시지는 ${REPLACEMENT_MESSAGE_MAX}자 이내로 입력해 주세요.` };
  }
  await mockDelay(250);
  store.replacement.message = message.trim();
  return { status: "SAVED" };
}

// ── 후원 리스트 ────────────────────────────────────────────────────────────────

/** 퀘스트 후원: the studio's quest records, newest first. 결정 buttons show while the creator may decide. */
function questDonations(): ReceivedDonation[] {
  return mockQuests.items
    .filter((q) => q.channelId === STUDIO_CHANNEL)
    .map((q) => ({
      id: q.id,
      at: q.createdAt,
      donorNickname: q.donor,
      donorId: q.donorId,
      amount: q.amount,
      message: q.title,
      status: q.status,
      detail: null,
      questActions: (q.status !== "IN_PROGRESS" ? [] : q.creatorDecides ? ["SUCCESS", "FAILED", "CANCELED"] : ["CANCELED"]) as QuestAction[]
    }))
    .sort((x, y) => y.at.localeCompare(x.at));
}

/**
 * The creator settles a quest sent to this channel: 성공 / 실패 only when the supporter turned on 크리에이터
 * 성공 결정, 취소 always. FAILED and CANCELED refund the whole amount to the supporter. Deciding again with
 * the same outcome is a no-op.
 */
export async function decideReceivedQuest(input: unknown): Promise<QuestDecideResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isQuestAction(v.outcome)) return { status: "INVALID" };
  const quest = findQuest(v.id);
  if (!quest || quest.channelId !== STUDIO_CHANNEL) return { status: "NOT_FOUND" };
  if (v.outcome !== "CANCELED" && !quest.creatorDecides) return { status: "FORBIDDEN" };
  await mockDelay(300);
  return decideQuest(quest, v.outcome, "CREATOR");
}

/** The 게임 후원 types — the same ones the supporter's 후원내역 files under 게임 후원 (donate.ts). */
const GAME_TYPES = ["ROULETTE", "GACHA"];
const GAME_MESSAGES = ["룰렛 한 번 돌려 주세요!", "뽑기 한 판 갑니다", "스탬프 나와라!", "상품권 노려 봅니다", "꽝만 나오지 마라…", "오늘의 행운 테스트"];

/** 게임 후원 (code-first): 24 donations spread over ~10 months ending now (deterministic mock). */
function mockGameDonations(): ReceivedDonation[] {
  const titles = GAME_TYPES.map((k) => getDonationCatalog().types.find((t) => t.key === k)?.title ?? k);
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const [nick, id] = FIXTURE_DONORS[(i + 3) % FIXTURE_DONORS.length];
    const at = new Date(now - Math.round(i * i * 0.5 * 86_400_000 + i * 5_100_000 + 1_800_000));
    return { id: `g${i + 1}`, at: at.toISOString(), donorNickname: nick, donorId: id, amount: FIXTURE_AMOUNTS[(i + 2) % FIXTURE_AMOUNTS.length], message: GAME_MESSAGES[i % GAME_MESSAGES.length], status: null, detail: titles[i % titles.length] };
  });
}

/** 크루 후원 (code-first): donations sent for a crew member of the studio's crew (후원 패널 멤버 지정). */
function crewDonations(): ReceivedDonation[] {
  return crewDonationRows(STUDIO_CHANNEL).map((r) => ({
    id: r.id,
    at: r.at,
    donorNickname: r.donor,
    donorId: r.donorId,
    amount: r.fnAmount,
    message: r.message,
    status: null,
    detail: r.member
  }));
}

type ListFilter = { kind: ListKind; period: ListPeriod; status: StatusFilter; query: string };

/** Server-side filtering shared by the paged list and the CSV export. */
function filterReceived(input: ListFilter) {
  const kind = LIST_KINDS.some((k) => k.key === input.kind) ? input.kind : "quest";
  // The 상태 filter only exists for 퀘스트 후원.
  const status: StatusFilter = kind === "quest" && QUEST_STATUSES.some((s) => s.key === input.status) ? input.status : "ALL";
  const query = input.query.trim().slice(0, LIST_QUERY_MAX).toLowerCase();
  const all = kind === "quest" ? questDonations() : kind === "game" ? mockGameDonations() : crewDonations();
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
  return { kind, status, matched, years };
}

export async function getReceivedDonations(input: ListFilter & { page: number }): Promise<ReceivedDonationPage | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(300);
  const { kind, status, matched, years } = filterReceived(input);
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

/** Spreadsheet-safe CSV cell: always quoted; formula-looking text (= + - @ tab CR) gets a leading '. */
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}


/**
 * 후원 리스트 CSV — code-first (funnation reference: 받은 후원 엑셀 다운로드). Same filters as the list,
 * every page, capped at CSV_EXPORT_MAX rows. UTF-8 with BOM so Excel opens Korean text correctly.
 * TBD: an audited export log, and whether donor ids may be exported (privacy review).
 */
export async function exportReceivedDonationsCsv(input: unknown): Promise<CsvExportResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const p = (typeof v.period === "object" && v.period !== null ? v.period : {}) as Record<string, unknown>;
  if (typeof p.from !== "string" || typeof p.to !== "string" || !isIsoDate(p.from) || !isIsoDate(p.to) || p.from > p.to) return { status: "INVALID" };
  const { kind, matched } = filterReceived({
    kind: v.kind as ListKind,
    period: { preset: "range", from: p.from, to: p.to },
    status: v.status as StatusFilter,
    query: typeof v.query === "string" ? v.query : ""
  });
  await mockDelay(300);
  const rows = matched.slice(0, CSV_EXPORT_MAX);
  const last = (d: ReceivedDonation) => (d.status ? QUEST_STATUSES.find((q) => q.key === d.status)!.label : (d.detail ?? ""));
  const column = kind === "quest" ? "상태" : LIST_KINDS.find((k) => k.key === kind)!.column;
  const lines = [
    ["후원일시", "후원자 닉네임", "후원자 아이디", "금액(FN)", "메시지", column].map(csvCell).join(","),
    ...rows.map((d) => [d.at, d.donorNickname, d.donorId, d.amount, d.message, last(d)].map(csvCell).join(","))
  ];
  return {
    status: "OK",
    filename: `somnation-donations-${kind}-${p.from}_${p.to}.csv`,
    csv: "﻿" + lines.join("\r\n"),
    rows: rows.length,
    truncated: matched.length > rows.length
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
  if (!(await getCreatorSession())) return null;
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

// ── 후원 필터링 ────────────────────────────────────────────────────────────────

type MockFilters = { settings: FilterSettings; blocked: BlockedDonor[]; titles: TitleTier[] };

const BLOCK_SEED: [string, string, string, BlockPlatform, string][] = [
  ["2026-09-11T04:12:00", "bad_player", "악성유저1", "CHZZK", "부적절한 닉네임 사용 및 연속적인 도배 광고"],
  ["2026-09-10T18:22:00", "spam_bot99", "광고봇", "SOOP", "불법 홍보 사이트 및 도배 스팸 전송"],
  ["2026-09-09T11:45:00", "no_manner", "비방러", "YOUTUBE", "타인 비방 목적의 비속어 메시지 후원 발생"],
  ["2026-09-08T22:10:00", "spoiler_king", "스포일러", "FLEXTV", "게임 중요 스토리 무단 스포일러 도배"]
];

const globalForFilters = globalThis as typeof globalThis & { __funationMockDonationFilters?: MockFilters };
const filters = (globalForFilters.__funationMockDonationFilters ??= {
  settings: { strength: "NORMAL", blockSpam: true, words: ["광고", "어그로", "욕설"] },
  blocked: BLOCK_SEED.map(([at, donorId, nickname, platform, reason], i) => ({
    id: `b${i + 1}`,
    blockedAt: new Date(at).toISOString(),
    donorId,
    nickname,
    platform,
    reason
  })),
  titles: TITLE_TIERS.map((threshold) => ({ threshold, enabled: false, name: "", description: "", iconUrl: null, color: "#FFFFFF" }))
});

export async function getFilterSettings(): Promise<FilterSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(250);
  return structuredClone(filters.settings);
}

export async function setFilterStrength(strength: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!FILTER_STRENGTHS.some((s) => s.key === strength)) return { status: "INVALID", message: "필터 강도를 선택해 주세요." };
  await mockDelay(250);
  filters.settings.strength = strength as FilterStrength;
  return { status: "SAVED" };
}

export async function setSpamBlock(on: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof on !== "boolean") return { status: "INVALID", message: "설정 값을 확인해 주세요." };
  await mockDelay(250);
  filters.settings.blockSpam = on;
  return { status: "SAVED" };
}

export async function addFilterWord(word: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const w = typeof word === "string" ? word.trim() : "";
  if (w.length < 1 || w.length > FILTER_WORD_MAX) return { status: "INVALID", message: `단어는 1~${FILTER_WORD_MAX}자로 입력해 주세요.` };
  if (filters.settings.words.includes(w)) return { status: "INVALID", message: "이미 등록된 단어입니다." };
  if (filters.settings.words.length >= FILTER_WORDS_MAX) return { status: "INVALID", message: `단어는 최대 ${FILTER_WORDS_MAX}개까지 등록할 수 있어요.` };
  await mockDelay(250);
  filters.settings.words = [...filters.settings.words, w];
  return { status: "SAVED" };
}

/** Idempotent. */
export async function removeFilterWord(word: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(200);
  filters.settings.words = filters.settings.words.filter((w) => w !== word);
  return { status: "SAVED" };
}

export async function getBlockedDonors(input: { query: string; page: number }): Promise<BlockedDonorPage | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(250);
  const query = input.query.trim().slice(0, LIST_QUERY_MAX);
  const q = query.toLowerCase();
  const matched = filters.blocked.filter((b) => !q || b.nickname.toLowerCase().includes(q) || b.donorId.toLowerCase().includes(q));
  const totalPages = Math.max(1, Math.ceil(matched.length / BLOCK_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(input.page) || 1), totalPages);
  return { query, page, totalPages, total: matched.length, items: matched.slice((page - 1) * BLOCK_PAGE_SIZE, page * BLOCK_PAGE_SIZE) };
}

/** 해제. Idempotent: unblocking someone who is not blocked is not an error. TODO: audit log on the backend. */
export async function unblockDonor(id: unknown): Promise<ManagementSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(300);
  filters.blocked = filters.blocked.filter((b) => b.id !== id);
  return { status: "SAVED" };
}

// ── 칭호 설정 ─────────────────────────────────────────────────────────────────

export async function getTitleTiers(): Promise<TitleTier[] | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(250);
  return structuredClone(filters.titles);
}

const findTier = (threshold: unknown) => filters.titles.find((t) => t.threshold === threshold);

export async function setTitleEnabled(threshold: unknown, enabled: unknown): Promise<TitleSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const tier = findTier(threshold);
  if (!tier || typeof enabled !== "boolean") return { status: "INVALID", message: "칭호 정보를 확인해 주세요." };
  if (enabled && !tier.name) return { status: "INVALID", message: "칭호명을 먼저 설정해 주세요." };
  await mockDelay(250);
  tier.enabled = enabled;
  return { status: "SAVED", tier: structuredClone(tier) };
}

/** FormData: threshold, name, description, color, optional icon (image), removeIcon ("1"). */
export async function saveTitleTier(formData: FormData): Promise<TitleSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const tier = findTier(Number(formData.get("threshold")));
  if (!tier) return { status: "INVALID", message: "칭호 정보를 확인해 주세요." };
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "");
  const icon = formData.get("icon");
  if (name.length < 1 || name.length > TITLE_NAME_MAX) return { status: "INVALID", message: `칭호명은 1~${TITLE_NAME_MAX}자로 입력해 주세요.` };
  if (description.length > TITLE_DESCRIPTION_MAX) return { status: "INVALID", message: `칭호 설명은 ${TITLE_DESCRIPTION_MAX}자 이내로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => `${name} ${description}`.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return { status: "INVALID", message: "색상은 #RRGGBB 형식으로 입력해 주세요." };
  let iconUrl = formData.get("removeIcon") === "1" ? null : tier.iconUrl;
  if (icon instanceof File && icon.size > 0) {
    if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(icon.type)) return { status: "INVALID", message: "JPG, PNG, WEBP 이미지만 등록할 수 있어요." };
    if (icon.size > PROFILE_PHOTO_MAX_BYTES) return { status: "INVALID", message: "이미지는 5MB 이하만 등록할 수 있어요." };
    // Mock storage: data URL in memory.
    iconUrl = `data:${icon.type};base64,${Buffer.from(await icon.arrayBuffer()).toString("base64")}`;
  }
  await mockDelay(400);
  Object.assign(tier, { name, description, color: color.toUpperCase(), iconUrl });
  return { status: "SAVED", tier: structuredClone(tier) };
}
