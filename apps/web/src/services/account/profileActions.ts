"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession, revokeSession } from "@/lib/session";
import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_TYPES, isValidSsumnationId, isValidPassword } from "@/lib/validation";
import { MOCK_FORBIDDEN_WORDS, MOCK_TAKEN_SSUMNATION_IDS, mockAccount, mockChangeHistory, mockCredentials } from "./mockStore";
import { judgeNickname, nicknamesTakenForMember } from "./nicknameRules";
import { clearPasswordFailures, currentAccountKey, isPasswordLocked, recordPasswordFailure } from "@/services/auth/loginLockCore";
import { matchesContent } from "@/services/creator/assetCore";

/**
 * My page profile changes (Figma 743:1955 photo · 743:1997 nickname · 743:2040 ID · 743:2084 password).
 *
 * Server Actions: every call re-checks the session and re-validates the input; the browser's
 * checks are only for instant feedback. Policies marked TBD are not defined yet.
 */

export type NicknameCheckResult = { status: "AVAILABLE" } | { status: "INVALID" } | { status: "DUPLICATE" } | { status: "FORBIDDEN" };

export type NameChangeResult =
  | { status: "CHANGED"; value: string }
  | { status: "INVALID" }
  | { status: "DUPLICATE" }
  | { status: "FORBIDDEN" }
  /** `availableFrom` is an ISO date string. */
  | { status: "LIMITED"; availableFrom: string }
  | { status: "UNAUTHORIZED" };

/** `RESERVED`: another member gave this 썸네이션 ID up less than ID_RESERVE_DAYS ago. */
export type IdChangeResult = NameChangeResult | { status: "RESERVED" };

export type PasswordChangeResult =
  | { status: "CHANGED" }
  | { status: "WRONG_CURRENT" }
  | { status: "INVALID" }
  | { status: "MISMATCH" }
  | { status: "REUSED" }
  /** Too many wrong current passwords: the account is locked like after 5 failed logins and the session ends. */
  | { status: "LOCKED" }
  | { status: "UNAUTHORIZED" };

export type PhotoUploadResult =
  | { status: "UPLOADED"; avatarUrl: string }
  | { status: "UNSUPPORTED" }
  | { status: "TOO_LARGE" }
  | { status: "FAILED" }
  | { status: "UNAUTHORIZED" };

/** Ssumnation ID: once every 30 days (Figma 743:2040 notice). */
const ID_CHANGE_INTERVAL_DAYS = 30;
/** TBD: the nickname interval is not specified; the mock reuses the ID interval. */
const NICKNAME_CHANGE_INTERVAL_DAYS = 30;
/**
 * A 썸네이션 ID given up by a change stays reserved this long, then anyone may take it (2026-10-08 결정 "일정 기간
 * 보호 후 해제" — 30 days decided, can be changed). Checked on the server for every ID change; sign-up does not pick an
 * ID yet, so when it does, it must check the same reservation.
 */
const ID_RESERVE_DAYS = 30;

/** Given-up IDs (lowercase) → when they are released (epoch ms). Mock store, kept on globalThis like the others. */
const globalForIds = globalThis as typeof globalThis & { __ssumnationMockReservedIdsV1?: Map<string, number> };
const reservedIds = () => (globalForIds.__ssumnationMockReservedIdsV1 ??= new Map());
const isReservedId = (id: string, now = Date.now()) => (reservedIds().get(id.toLowerCase()) ?? 0) > now;

const containsForbidden = (value: string) => MOCK_FORBIDDEN_WORDS.some((w) => value.toLowerCase().includes(w));

function limitedUntil(changedAt: Date | null, days: number) {
  if (!changedAt) return null;
  const until = new Date(changedAt.getTime() + days * 24 * 60 * 60 * 1000);
  return until > new Date() ? until : null;
}

function assertMock() {
  if (!USE_MOCK) throw new Error("Account API is not connected yet.");
}

/** Nickname rules shared with sign-up (./nicknameRules.ts): format, forbidden words, 익명, other members' and channel names. */
export async function checkNickname(nickname: unknown): Promise<NicknameCheckResult> {
  assertMock();
  await mockDelay(300);
  return { status: judgeNickname(nickname, await nicknamesTakenForMember()) };
}

export async function changeNickname(nickname: unknown): Promise<NameChangeResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const taken = await nicknamesTakenForMember();
  // From here to the write nothing awaits: two tabs cannot both pass the 30-day limit.
  const until = limitedUntil(mockChangeHistory.nicknameChangedAt, NICKNAME_CHANGE_INTERVAL_DAYS);
  if (until) return { status: "LIMITED", availableFrom: until.toISOString() };
  const verdict = judgeNickname(nickname, taken);
  if (verdict !== "AVAILABLE") return { status: verdict };
  mockAccount.nickname = nickname as string;
  mockChangeHistory.nicknameChangedAt = new Date();
  return { status: "CHANGED", value: mockAccount.nickname };
}

export async function changeSsumnationId(ssumnationId: unknown): Promise<IdChangeResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const until = limitedUntil(mockChangeHistory.ssumnationIdChangedAt, ID_CHANGE_INTERVAL_DAYS);
  if (until) return { status: "LIMITED", availableFrom: until.toISOString() };
  if (typeof ssumnationId !== "string" || !isValidSsumnationId(ssumnationId)) return { status: "INVALID" };
  if (containsForbidden(ssumnationId)) return { status: "FORBIDDEN" };
  // The current ID counts as taken (Figma 747:349 uses the member's own ID as the example).
  if (MOCK_TAKEN_SSUMNATION_IDS.includes(ssumnationId) || ssumnationId === mockAccount.ssumnationId.toLowerCase()) {
    return { status: "DUPLICATE" };
  }
  if (isReservedId(ssumnationId)) return { status: "RESERVED" };
  const now = new Date();
  reservedIds().set(mockAccount.ssumnationId.toLowerCase(), now.getTime() + ID_RESERVE_DAYS * 86_400_000);
  mockAccount.ssumnationId = ssumnationId;
  mockChangeHistory.ssumnationIdChangedAt = now;
  return { status: "CHANGED", value: ssumnationId };
}

export async function changePassword(input: { current: unknown; next: unknown; confirm: unknown }): Promise<PasswordChangeResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const { current, next, confirm } = input ?? {};
  // The current password shares the login's failure count (services/auth/loginLockCore.ts), so a session
  // cannot be used to guess it: at the login's limit the account locks and the session ends.
  const account = currentAccountKey();
  if (isPasswordLocked(account)) {
    await revokeSession();
    return { status: "LOCKED" };
  }
  if (typeof current !== "string" || current !== mockCredentials.password) {
    if (!recordPasswordFailure(account)) return { status: "WRONG_CURRENT" };
    await revokeSession();
    return { status: "LOCKED" };
  }
  clearPasswordFailures(account);
  if (typeof next !== "string" || !isValidPassword(next)) return { status: "INVALID" };
  if (next !== confirm) return { status: "MISMATCH" };
  // TBD: how many previous passwords count as "recent".
  if (mockCredentials.recentPasswords.includes(next)) return { status: "REUSED" };
  mockCredentials.password = next;
  mockCredentials.recentPasswords = [next, ...mockCredentials.recentPasswords].slice(0, 3);
  mockCredentials.changedAt = new Date().toISOString();
  // Figma 747:738: the member must sign in again after changing the password.
  await revokeSession();
  return { status: "CHANGED" };
}

export async function uploadProfilePhoto(formData: FormData): Promise<PhotoUploadResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const file = formData.get("photo");
  if (!(file instanceof File)) return { status: "FAILED" };
  if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(file.type)) return { status: "UNSUPPORTED" };
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return { status: "TOO_LARGE" };
  // The bytes must really be that image type (a renamed file is refused).
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesContent(bytes, file.type)) return { status: "UNSUPPORTED" };
  await mockDelay(600);
  // Mock storage: keep the image in memory as a data URL. The real backend stores it and returns a URL.
  mockAccount.avatarUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  return { status: "UPLOADED", avatarUrl: mockAccount.avatarUrl };
}
