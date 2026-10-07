"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { computeIdentity, nicknameList, resolveBadges } from "./identityCore";
import { MAX_NICKNAMES, NICKNAME_RULE, isReservedNickname, type AlertBadges, type EquipSettings, type GlobalTitleKey, type IdentitySaveResult, type SupporterIdentity } from "./identityTypes";
import { mockIdentity } from "./mockIdentityStore";

/**
 * Supporter identity Server Actions — code-first (no Figma frame). Routes `/mypage/titles`,
 * `/mypage/nicknames`. Grades and titles are computed on the server from completed donation
 * records; thresholds are placeholders (TBD). TBD: whether grades decay, title rewards, nickname
 * change limits, moderation of nicknames.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Supporter identity API is not connected yet.");
};

export async function getSupporterIdentity(): Promise<SupporterIdentity | null> {
  assertMock();
  if (!(await getSession())) return null;
  await mockDelay(250);
  return computeIdentity();
}

// ── 별명 관리 ──────────────────────────────────────────────────────────────────

function checkName(name: unknown, exceptId?: string): string | null {
  if (typeof name !== "string" || !NICKNAME_RULE.test(name.trim())) return "2~12자의 한글, 영문, 숫자, _만 사용할 수 있어요.";
  const n = name.trim();
  // 익명 is what a hidden profile shows: an 별명 cannot pose as it (TBD: uniqueness across members).
  if (isReservedNickname(n) || MOCK_FORBIDDEN_WORDS.some((w) => n.toLowerCase().includes(w))) return "사용할 수 없는 단어가 포함되어 있어요.";
  if (nicknameList().some((x) => x.id !== exceptId && x.name.toLowerCase() === n.toLowerCase())) return "이미 등록한 별명이에요.";
  return null;
}

export async function addDonationNickname(name: unknown): Promise<IdentitySaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (nicknameList().length >= MAX_NICKNAMES) return { status: "INVALID", message: `별명은 최대 ${MAX_NICKNAMES}개까지 등록할 수 있어요.` };
  const error = checkName(name);
  if (error) return { status: "INVALID", message: error };
  await mockDelay(300);
  mockIdentity.nicknames.push({ id: `nk-${Date.now().toString(36)}${mockIdentity.nicknames.length}`, name: (name as string).trim() });
  return { status: "SAVED" };
}

export async function renameDonationNickname(id: unknown, name: unknown): Promise<IdentitySaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const target = mockIdentity.nicknames.find((n) => n.id === id);
  // The default "nk-default" nickname follows the account nickname (changed on my page).
  if (!target) return { status: "INVALID", message: "기본 별명은 마이페이지에서 닉네임으로 변경할 수 있어요." };
  const error = checkName(name, target.id);
  if (error) return { status: "INVALID", message: error };
  await mockDelay(300);
  target.name = (name as string).trim();
  return { status: "SAVED" };
}

/** Past donations move back under the default nickname when a nickname is removed. Idempotent. */
export async function removeDonationNickname(id: unknown): Promise<IdentitySaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (id === "nk-default") return { status: "INVALID", message: "기본 별명은 삭제할 수 없어요." };
  await mockDelay(300);
  mockIdentity.nicknames = mockIdentity.nicknames.filter((n) => n.id !== id);
  if (mockIdentity.defaultId === id) mockIdentity.defaultId = "nk-default";
  for (const [donation, nick] of Object.entries(mockIdentity.attribution)) if (nick === id) delete mockIdentity.attribution[donation];
  return { status: "SAVED" };
}

export async function setDefaultDonationNickname(id: unknown): Promise<IdentitySaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!nicknameList().some((n) => n.id === id)) return { status: "INVALID", message: "별명을 찾을 수 없어요." };
  await mockDelay(200);
  mockIdentity.defaultId = id as string;
  return { status: "SAVED" };
}

// ── 칭호 장착 ──────────────────────────────────────────────────────────────────

export async function saveEquipSettings(input: unknown): Promise<IdentitySaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Partial<EquipSettings>;
  if (typeof v.showGrade !== "boolean" || typeof v.showStoreTitle !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  const g = v.globalTitle;
  // A specific title must be one the supporter has actually earned (checked on the server).
  if (g !== "AUTO" && g !== "OFF" && !computeIdentity().global.earned.includes(g as GlobalTitleKey)) {
    return { status: "INVALID", message: "아직 획득하지 않은 칭호예요." };
  }
  await mockDelay(250);
  mockIdentity.equip = { showGrade: v.showGrade, globalTitle: g as EquipSettings["globalTitle"], showStoreTitle: v.showStoreTitle };
  return { status: "SAVED" };
}

// ── Donation panel ─────────────────────────────────────────────────────────────

/** Nicknames selectable in the donation panel, default first. */
export async function getDonationNicknameOptions(): Promise<{ id: string; name: string }[] | null> {
  assertMock();
  if (!(await getSession())) return null;
  const list = nicknameList();
  return [...list.filter((n) => n.id === mockIdentity.defaultId), ...list.filter((n) => n.id !== mockIdentity.defaultId)];
}

/** Server-resolved badges a donation alert would show (alert preview). */
export async function getAlertBadges(nicknameId: unknown, creatorId: unknown): Promise<AlertBadges | null> {
  assertMock();
  if (!(await getSession())) return null;
  return resolveBadges(nicknameId, creatorId);
}
