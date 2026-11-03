import { checkNickname as checkFlextvNickname, requestFrom } from "@/lib/flextv/auth";
import { fetchMyAccount, updateNickname, updatePassword, updateProfilePhoto, type FlextvMyAccount } from "@/lib/flextv/member";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { isFlextvNickname, isFlextvPassword } from "@/lib/flextv/rules";
import { forgetFlextvSession, getFlextvAccessToken, revokeSession } from "@/lib/session";
import type { NameChangeResult, NicknameCheckResult, PasswordChangeResult, PhotoUploadResult } from "./profileActions";

/**
 * 마이페이지 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): the account FLEXTV keeps, and the changes
 * FLEXTV takes from another site — 닉네임, 프로필 사진, 비밀번호. 본인인증 and 회원 탈퇴 happen on FLEXTV's site; a
 * 아이디 cannot be changed. The Server Actions of ./profileActions.ts delegate here, after their own checks.
 */

const serialize = createQueue("profile");

export async function getFlextvMyAccount(): Promise<FlextvMyAccount | null> {
  const token = await getFlextvAccessToken();
  return token ? fetchMyAccount(token) : null;
}

/** FLEXTV's rules first (lib/flextv/rules.ts), then FLEXTV's own check. Forbidden words are checked on the change. */
export async function flextvCheckNickname(nickname: unknown): Promise<NicknameCheckResult> {
  if (typeof nickname !== "string" || !isFlextvNickname(nickname)) return { status: "INVALID" };
  const availability = await checkFlextvNickname(nickname);
  return { status: availability === "AVAILABLE" ? "AVAILABLE" : availability === "TAKEN" ? "DUPLICATE" : "INVALID" };
}

export async function flextvChangeNickname(nickname: unknown): Promise<NameChangeResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (typeof nickname !== "string" || !isFlextvNickname(nickname)) return { status: "INVALID" };
  const caller = requestFrom(await requestDeviceContext());
  const result = await serialize(token, () => updateNickname(token, nickname, caller));
  if (result.kind !== "OK") return { status: result.kind };
  // The header and the menus show the session's nickname: ask FLEXTV again on the next page.
  await forgetFlextvSession();
  return { status: "CHANGED", value: nickname };
}

/** `photo` passed ./profileActions.ts's checks (type, size and the bytes themselves). */
export async function flextvUploadProfilePhoto(photo: File): Promise<PhotoUploadResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  const result = await serialize(token, () => updateProfilePhoto(token, photo, photo.name || "profile", caller));
  if (result.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  if (result.kind !== "OK") return { status: "FAILED" };
  await forgetFlextvSession();
  const account = await fetchMyAccount(token);
  return account?.thumbUrl ? { status: "UPLOADED", avatarUrl: account.thumbUrl } : { status: "FAILED" };
}

/**
 * FLEXTV's password rule (8–15 characters with a letter, a digit and a special character, as at its sign-up) is checked
 * here before FLEXTV is asked. As with the mock (Figma 747:738), the member signs in again afterwards.
 */
export async function flextvChangePassword(input: { current: unknown; next: unknown; confirm: unknown }): Promise<PasswordChangeResult> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  const { current, next, confirm } = input ?? {};
  if (typeof current !== "string" || !current) return { status: "WRONG_CURRENT" };
  if (typeof next !== "string" || !isFlextvPassword(next)) return { status: "INVALID" };
  if (next !== confirm) return { status: "MISMATCH" };
  const caller = requestFrom(await requestDeviceContext());
  const result = await serialize(token, () => updatePassword(token, current, next, caller));
  if (result.kind !== "CHANGED") return { status: result.kind };
  await revokeSession();
  return { status: "CHANGED" };
}
