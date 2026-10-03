"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession, revokeSession } from "@/lib/session";
import {
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_TYPES,
  isValidFunationId,
  isValidNewPassword,
  isValidNickname
} from "@/lib/validation";
import {
  MOCK_FORBIDDEN_WORDS,
  MOCK_TAKEN_FUNATION_IDS,
  MOCK_TAKEN_NICKNAMES,
  mockAccount,
  mockChangeHistory,
  mockCredentials
} from "./mockStore";
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

export type PasswordChangeResult =
  | { status: "CHANGED" }
  | { status: "WRONG_CURRENT" }
  | { status: "INVALID" }
  | { status: "MISMATCH" }
  | { status: "REUSED" }
  | { status: "UNAUTHORIZED" };

export type PhotoUploadResult =
  | { status: "UPLOADED"; avatarUrl: string }
  | { status: "UNSUPPORTED" }
  | { status: "TOO_LARGE" }
  | { status: "FAILED" }
  | { status: "UNAUTHORIZED" };

/** Funation ID: once every 30 days (Figma 743:2040 notice). */
const ID_CHANGE_INTERVAL_DAYS = 30;
/** TBD: the nickname interval is not specified; the mock reuses the ID interval. */
const NICKNAME_CHANGE_INTERVAL_DAYS = 30;

const containsForbidden = (value: string) => MOCK_FORBIDDEN_WORDS.some((w) => value.toLowerCase().includes(w));

function limitedUntil(changedAt: Date | null, days: number) {
  if (!changedAt) return null;
  const until = new Date(changedAt.getTime() + days * 24 * 60 * 60 * 1000);
  return until > new Date() ? until : null;
}

function assertMock() {
  if (!USE_MOCK) throw new Error("Account API is not connected yet.");
}

export async function checkNickname(nickname: unknown): Promise<NicknameCheckResult> {
  assertMock();
  await mockDelay(300);
  if (typeof nickname !== "string" || !isValidNickname(nickname)) return { status: "INVALID" };
  if (containsForbidden(nickname)) return { status: "FORBIDDEN" };
  if (MOCK_TAKEN_NICKNAMES.includes(nickname.toLowerCase())) return { status: "DUPLICATE" };
  return { status: "AVAILABLE" };
}

export async function changeNickname(nickname: unknown): Promise<NameChangeResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const until = limitedUntil(mockChangeHistory.nicknameChangedAt, NICKNAME_CHANGE_INTERVAL_DAYS);
  if (until) return { status: "LIMITED", availableFrom: until.toISOString() };
  const check = await checkNickname(nickname);
  if (check.status !== "AVAILABLE") return check;
  mockAccount.nickname = nickname as string;
  mockChangeHistory.nicknameChangedAt = new Date();
  return { status: "CHANGED", value: mockAccount.nickname };
}

export async function changeFunationId(funationId: unknown): Promise<NameChangeResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const until = limitedUntil(mockChangeHistory.funationIdChangedAt, ID_CHANGE_INTERVAL_DAYS);
  if (until) return { status: "LIMITED", availableFrom: until.toISOString() };
  if (typeof funationId !== "string" || !isValidFunationId(funationId)) return { status: "INVALID" };
  if (containsForbidden(funationId)) return { status: "FORBIDDEN" };
  // The current ID counts as taken (Figma 747:349 uses the member's own ID as the example).
  if (MOCK_TAKEN_FUNATION_IDS.includes(funationId) || funationId === mockAccount.funationId.toLowerCase()) {
    return { status: "DUPLICATE" };
  }
  mockAccount.funationId = funationId;
  mockChangeHistory.funationIdChangedAt = new Date();
  return { status: "CHANGED", value: funationId };
}

export async function changePassword(input: { current: unknown; next: unknown; confirm: unknown }): Promise<PasswordChangeResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const { current, next, confirm } = input ?? {};
  if (typeof current !== "string" || current !== mockCredentials.password) return { status: "WRONG_CURRENT" };
  if (typeof next !== "string" || !isValidNewPassword(next)) return { status: "INVALID" };
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
