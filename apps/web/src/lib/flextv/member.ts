import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";
import { readTokens } from "./tokens";

/**
 * 마이페이지 on FLEXTV (phase 7): the member's own account (`GET /api/my/profile`), the nickname and profile photo
 * (`PUT /api/my/profile`, multipart) and the password (`POST /api/oauth/password`) — server/routes/api/my and oauth of
 * FLEXTV's web repository. 본인인증 and 회원 탈퇴 stay on FLEXTV's site. The `map*` functions are pure (member.test.ts).
 */

/** How the member signed up: FLEXTV's `oauth.provider`, or null for a 아이디 · 비밀번호 account. */
export type FlextvSignUpProvider = "kakao" | "naver" | "google" | "twitch" | "other";

export type FlextvMyAccount = {
  nickname: string;
  loginId: string;
  /** FLEXTV hands its default picture when the member has none. */
  thumbUrl: string | null;
  provider: FlextvSignUpProvider | null;
  /** False for a member who signed up with Kakao · Naver · Google only (FLEXTV keeps no password for them). */
  hasPassword: boolean;
  /** FLEXTV's 본인인증 (its `PI`, set once the member verified with NICE). */
  verified: boolean;
  /** 렉스 (FN on Ssumnation's screens), display only — FLEXTV's ledger owns it. */
  balance: number;
  /** FLEXTV has 알림 the member has not looked at (its `setting.notificationView`). */
  newNotifications: boolean;
};

const PROVIDERS: readonly FlextvSignUpProvider[] = ["kakao", "naver", "google", "twitch"];

/** FLEXTV's `passwordCheck` is true for a member it keeps no password for (a Kakao · Naver · Google sign-up). */
export function readMyAccount(raw: unknown): FlextvMyAccount | null {
  if (!isRecord(raw) || !isRecord(raw.profile)) return null;
  const p = raw.profile;
  if (typeof p.loginId !== "string" || typeof p.nickname !== "string") return null;
  const provider = isRecord(p.oauth) && typeof p.oauth.provider === "string" ? p.oauth.provider : null;
  const balance = Number(raw.luv);
  return {
    nickname: p.nickname,
    loginId: p.loginId,
    thumbUrl: typeof p.thumbUrl === "string" && /^https:\/\//.test(p.thumbUrl) ? p.thumbUrl : null,
    provider: provider === null ? null : PROVIDERS.includes(provider as FlextvSignUpProvider) ? (provider as FlextvSignUpProvider) : "other",
    hasPassword: p.passwordCheck !== true,
    verified: isRecord(p.PI),
    balance: Number.isSafeInteger(balance) && balance >= 0 ? balance : 0,
    newNotifications: isRecord(p.setting) && p.setting.notificationView === 1
  };
}

/** The member's account, or null when FLEXTV no longer accepts the token. */
export async function fetchMyAccount(token: string): Promise<FlextvMyAccount | null> {
  const response = await flextvRequest("/api/my/profile", { token });
  if (response.status === 401) return null;
  const account = response.status === 200 ? readMyAccount(response.data) : null;
  if (!account) throw new FlextvUnavailableError(`FLEXTV profile answered ${response.status}`);
  return account;
}

/* ── 닉네임 · 프로필 사진 ─────────────────────────────────── */

export type ProfileUpdate = { kind: "OK" } | { kind: "INVALID" } | { kind: "DUPLICATE" } | { kind: "FORBIDDEN" } | { kind: "UNAUTHORIZED" };

/**
 * `PUT /api/my/profile` answers 200 with "OK", or with the reason as text: "잘못된 입력값입니다." (format),
 * "사용할 수 없는 이모지가 포함되었습니다.", "금지된 단어는 입력할 수 없습니다.", "동일한 닉네임이 존재합니다.".
 */
export function mapProfileUpdate({ status, data }: Pick<FlextvResponse, "status" | "data">): ProfileUpdate {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status !== 200 || typeof data !== "string") throw new FlextvUnavailableError(`FLEXTV profile update answered ${status}`);
  if (data === "OK") return { kind: "OK" };
  if (data.includes("동일한 닉네임")) return { kind: "DUPLICATE" };
  if (data.includes("금지")) return { kind: "FORBIDDEN" };
  if (data.includes("잘못된 입력") || data.includes("이모지")) return { kind: "INVALID" };
  throw new FlextvUnavailableError("FLEXTV profile update answered an unknown reason");
}

type Caller = Pick<FlextvRequest, "clientIp" | "userAgent">;

/** FLEXTV decodes the nickname it is sent (`decodeURIComponent`), so it goes encoded. */
export async function updateNickname(token: string, nickname: string, caller: Caller): Promise<ProfileUpdate> {
  const form = new FormData();
  form.set("nickname", encodeURIComponent(nickname));
  return mapProfileUpdate(await flextvRequest("/api/my/profile", { method: "PUT", form, token, ...caller }));
}

/** The photo as checked by the caller (type, size, content); FLEXTV stores it and serves it from its CDN. */
export async function updateProfilePhoto(token: string, photo: Blob, filename: string, caller: Caller): Promise<ProfileUpdate> {
  const form = new FormData();
  form.set("image", photo, filename);
  return mapProfileUpdate(await flextvRequest("/api/my/profile", { method: "PUT", form, token, ...caller }));
}

/* ── 비밀번호 ────────────────────────────────────────────── */

export type PasswordUpdate = { kind: "CHANGED" } | { kind: "WRONG_CURRENT" } | { kind: "REUSED" } | { kind: "UNAUTHORIZED" };

/**
 * `POST /api/oauth/password` answers 200 in every case: the new tokens on success, or `{ status, msg }` — 1 · 2 signed
 * out, 3 the current password is wrong, 4 the new one is the current one.
 */
export function mapPasswordUpdate({ status, data }: Pick<FlextvResponse, "status" | "data">): PasswordUpdate {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 200 && isRecord(data)) {
    if (readTokens(data)) return { kind: "CHANGED" };
    if (data.status === 1 || data.status === 2) return { kind: "UNAUTHORIZED" };
    if (data.status === 3) return { kind: "WRONG_CURRENT" };
    if (data.status === 4) return { kind: "REUSED" };
  }
  throw new FlextvUnavailableError(`FLEXTV password change answered ${status}`);
}

export async function updatePassword(token: string, current: string, next: string, caller: Caller): Promise<PasswordUpdate> {
  return mapPasswordUpdate(await flextvRequest("/api/oauth/password", { method: "POST", body: { prePassword: current, password: next }, token, ...caller }));
}
