import type { Session } from "@/lib/session";
import type { Role } from "@/types/role";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";
import { readTokens, readTokensFromSetCookie, type FlextvTokens } from "./tokens";

/**
 * FLEXTV's member API, mapped to what Ssumnation's auth needs (docs/development/flextv-backend.md "API 대응").
 * The `map*` functions are pure so the mapping of each FLEXTV answer is tested on its own (`auth.test.ts`).
 * Edge-safe: the middleware uses `refreshTokens`.
 */

export type FlextvMember = {
  id: number;
  loginId: string;
  nickname: string;
  thumbUrl: string | null;
  /** 1 일반 · 2 본사 소속 · 3 엔터 소속 … (FLEXTV `MEMBER_DIV`) */
  memberDiv: number | null;
  /** 1 정상 · 3 휴면 · 4 정지 · 8 탈퇴 (FLEXTV `MEMBER_STATUS`) */
  status: number | null;
};

export type SocialProvider = "kakao" | "naver" | "google";
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ["kakao", "naver", "google"];
export const isSocialProvider = (value: unknown): value is SocialProvider => SOCIAL_PROVIDERS.includes(value as SocialProvider);

/** Who is asking: FLEXTV counts logins and checks its black-IP list per IP, and records the device. */
export type DeviceContext = { clientIp: string | null; device: "PCWEB" | "MOBILEWEB" };

export function deviceContextFrom(headers: Pick<Headers, "get">): DeviceContext {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwarded || headers.get("x-real-ip")?.trim() || null;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(headers.get("user-agent") ?? "");
  return { clientIp, device: mobile ? "MOBILEWEB" : "PCWEB" };
}

const MEMBER_STATUS_NORMAL = 1;
/** FLEXTV members who broadcast: 본사 소속 (2, also every 개인 BJ after 방송 신청) and 엔터 소속 (3). */
const BROADCASTER_MEMBER_DIVS = [2, 3];

export function readMember(raw: unknown): FlextvMember | null {
  if (!isRecord(raw)) return null;
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (typeof raw.loginId !== "string" || typeof raw.nickname !== "string") return null;
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    id,
    loginId: raw.loginId,
    nickname: raw.nickname,
    thumbUrl: typeof raw.thumbUrl === "string" && /^https:\/\//.test(raw.thumbUrl) ? raw.thumbUrl : null,
    memberDiv: num(raw.memberDiv),
    status: num(raw.status)
  };
}

/**
 * Ssumnation's session for a FLEXTV member, or null when the member may not use the site (휴면 · 정지 · 탈퇴).
 * Every member is a Supporter; FLEXTV's broadcasters are Creators. Admin stays the console's own sign-in.
 */
export function sessionFromMember(member: FlextvMember): Session | null {
  if (member.status !== null && member.status !== MEMBER_STATUS_NORMAL) return null;
  const roles: Role[] = ["SUPPORTER"];
  if (member.memberDiv !== null && BROADCASTER_MEMBER_DIVS.includes(member.memberDiv)) roles.push("CREATOR");
  return { userId: String(member.id), nickname: member.nickname, ssumnationId: member.loginId, avatarUrl: member.thumbUrl, roles };
}

/* ── Sign-in ─────────────────────────────────────────────── */

export type SignInOutcome =
  | { kind: "OK"; tokens: FlextvTokens; member: FlextvMember }
  /** A social account that no FLEXTV member has yet: sign up with it. */
  | { kind: "NEW_MEMBER" }
  | { kind: "WRONG_PASSWORD" }
  /** 20 wrong passwords within 10 minutes: FLEXTV refuses for 10 minutes. */
  | { kind: "TOO_MANY_ATTEMPTS" }
  /** Unknown 아이디 — FLEXTV answers a 휴면 · 정지 · 탈퇴 member and a refused social token the same way (empty 401). */
  | { kind: "NOT_FOUND" }
  /** A blocked member or IP (423). */
  | { kind: "BLOCKED" };

export function mapSignIn({ status, data }: Pick<FlextvResponse, "status" | "data">): SignInOutcome {
  const body = isRecord(data) ? data : {};
  if (status === 200) {
    if (body.isNew === true) return { kind: "NEW_MEMBER" };
    const tokens = readTokens(body.token);
    // The body spreads FLEXTV's profile at the top and adds the member row under `member`; the profile wins.
    const member = readMember({ ...(isRecord(body.member) ? body.member : {}), ...body });
    if (tokens && member) return { kind: "OK", tokens, member };
    throw new FlextvUnavailableError("FLEXTV sign-in answered without tokens or member");
  }
  if (status === 401) {
    if (body.error === 2) return { kind: "WRONG_PASSWORD" };
    if (body.error === 1) return { kind: "TOO_MANY_ATTEMPTS" };
    // "로그인 처리 중 문제가 발생했습니다": FLEXTV's oauth server failed — not the member's mistake.
    if (typeof body.msg === "string") throw new FlextvUnavailableError("FLEXTV could not issue tokens");
    return { kind: "NOT_FOUND" };
  }
  if (status === 423) return { kind: "BLOCKED" };
  throw new FlextvUnavailableError(`FLEXTV sign-in answered ${status}`);
}

export async function signIn(
  { loginId, password, keepSignedIn }: { loginId: string; password: string; keepSignedIn: boolean },
  context: DeviceContext
): Promise<SignInOutcome> {
  const response = await flextvRequest("/v2/api/auth/signin", {
    method: "POST",
    // `device` must be set: without it FLEXTV treats the call as its app and drops the member's push device.
    body: { loginId, password, loginKeep: keepSignedIn, saveId: false, device: context.device },
    clientIp: context.clientIp
  });
  return mapSignIn(response);
}

const SOCIAL_SIGN_IN_PATH: Record<SocialProvider, string> = {
  kakao: "/v2/api/auth/signin/oauth/kakao",
  naver: "/v2/api/auth/signin/oauth/naver",
  google: "/api/auth/signin/oauth/google"
};

/** `providerToken`: the Kakao or Naver access token, Google's ID token (FLEXTV checks it was issued to its own app). */
export async function signInWithProvider(provider: SocialProvider, providerToken: string, context: DeviceContext): Promise<SignInOutcome> {
  const response = await flextvRequest(SOCIAL_SIGN_IN_PATH[provider], {
    method: "POST",
    body: { accessToken: providerToken, device: context.device },
    clientIp: context.clientIp
  });
  return mapSignIn(response);
}

/* ── Sign-up ─────────────────────────────────────────────── */

export type SignUpOutcome =
  /** `tokens` null: FLEXTV created the member but sent no token cookies — sign in to get them. */
  | { kind: "CREATED"; member: FlextvMember | null; tokens: FlextvTokens | null }
  | { kind: "LOGIN_ID_TAKEN" }
  | { kind: "NICKNAME_TAKEN" }
  /** A forbidden word in the nickname (the 아이디's reserved word is refused before FLEXTV is asked). */
  | { kind: "FORBIDDEN_WORD" }
  /** The member's IP is on FLEXTV's black list. */
  | { kind: "BLOCKED" }
  /** FLEXTV refused the social token (expired or not from its app). */
  | { kind: "PROVIDER_REFUSED" }
  | { kind: "INVALID" };

/** FLEXTV's sign-up refusals are 400s with a Korean `message` (translated to 'ko' without FLEXTV's locale cookie). */
const SIGN_UP_MESSAGES: Record<string, SignUpOutcome["kind"]> = {
  "이미 가입된 회원입니다.": "LOGIN_ID_TAKEN",
  "이미 존재하는 닉네임입니다.": "NICKNAME_TAKEN",
  "금지된 단어입니다.": "FORBIDDEN_WORD",
  "접근 불가 아이피입니다.": "BLOCKED",
  "Invalid Token": "PROVIDER_REFUSED"
};

export function mapSignUp({ status, data, setCookies }: FlextvResponse): SignUpOutcome {
  if (status === 200) return { kind: "CREATED", member: readMember(data), tokens: readTokensFromSetCookie(setCookies) };
  if (status === 400) {
    const message = isRecord(data) && typeof data.message === "string" ? data.message : "";
    const kind = SIGN_UP_MESSAGES[message] ?? "INVALID";
    return { kind } as SignUpOutcome;
  }
  if (status === 401) return { kind: "PROVIDER_REFUSED" };
  throw new FlextvUnavailableError(`FLEXTV sign-up answered ${status}`);
}

export async function signUp(
  { loginId, password, nickname }: { loginId: string; password: string; nickname: string },
  context: DeviceContext
): Promise<SignUpOutcome> {
  const response = await flextvRequest("/api/auth/signup", {
    method: "POST",
    body: { loginId, nickname, password, device: context.device },
    clientIp: context.clientIp
  });
  return mapSignUp(response);
}

export async function signUpWithProvider(provider: SocialProvider, providerToken: string, nickname: string, context: DeviceContext): Promise<SignUpOutcome> {
  const response = await flextvRequest(`/api/auth/signup/oauth/${provider}`, {
    method: "POST",
    body: { accessToken: providerToken, nickname, device: context.device },
    clientIp: context.clientIp
  });
  return mapSignUp(response);
}

/* ── 중복 확인 ───────────────────────────────────────────── */

export type Availability = "AVAILABLE" | "TAKEN" | "INVALID";

/** `/api/guest/loginId/:id` answers "ok", or "overlap" · "stoped" · "secession" (a 정지 or 탈퇴 member keeps the 아이디). */
export function mapLoginIdCheck({ status, data }: Pick<FlextvResponse, "status" | "data">): Availability {
  if (status !== 200) throw new FlextvUnavailableError(`FLEXTV 아이디 check answered ${status}`);
  if (data === "ok") return "AVAILABLE";
  if (data === "overlap" || data === "stoped" || data === "secession") return "TAKEN";
  throw new FlextvUnavailableError("FLEXTV 아이디 check answered an unknown value");
}

/** `/api/guest/nickname/:nickname` answers "ok", "overlap", or "error" for a value it cannot look up (an emoji). */
export function mapNicknameCheck({ status, data }: Pick<FlextvResponse, "status" | "data">): Availability {
  if (status !== 200) throw new FlextvUnavailableError(`FLEXTV nickname check answered ${status}`);
  if (data === "ok") return "AVAILABLE";
  if (data === "overlap") return "TAKEN";
  if (data === "error") return "INVALID";
  throw new FlextvUnavailableError("FLEXTV nickname check answered an unknown value");
}

export async function checkLoginId(loginId: string): Promise<Availability> {
  return mapLoginIdCheck(await flextvRequest(`/api/guest/loginId/${encodeURIComponent(loginId)}`));
}

export async function checkNickname(nickname: string): Promise<Availability> {
  return mapNicknameCheck(await flextvRequest(`/api/guest/nickname/${encodeURIComponent(nickname)}`));
}

/* ── Session ─────────────────────────────────────────────── */

/** The member behind an access token, or null when FLEXTV no longer accepts it (401). */
export async function fetchMyProfile(accessToken: string): Promise<FlextvMember | null> {
  const response = await flextvRequest("/api/my/profile", { token: accessToken });
  if (response.status === 401) return null;
  if (response.status !== 200 || !isRecord(response.data)) throw new FlextvUnavailableError(`FLEXTV profile answered ${response.status}`);
  return readMember(response.data.profile);
}

export type RefreshOutcome = { kind: "OK"; tokens: FlextvTokens } | { kind: "INVALID" };

export function mapRefresh({ status, data }: Pick<FlextvResponse, "status" | "data">, refreshToken: string): RefreshOutcome {
  if (status === 401) return { kind: "INVALID" };
  if (status !== 200) throw new FlextvUnavailableError(`FLEXTV refresh answered ${status}`);
  const tokens = readTokens(data, refreshToken);
  // { msg: "ERROR" } or the oauth server's { status, result: "Error" }: the refresh token is no longer valid.
  return tokens ? { kind: "OK", tokens } : { kind: "INVALID" };
}

export async function refreshTokens(refreshToken: string): Promise<RefreshOutcome> {
  return mapRefresh(await flextvRequest("/api/oauth/refresh", { method: "POST", body: { refreshToken } }), refreshToken);
}
