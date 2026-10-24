import { describe, expect, it } from "vitest";
import {
  deviceContextFrom,
  mapLoginIdCheck,
  mapNicknameCheck,
  mapRefresh,
  mapSignIn,
  mapSignUp,
  readMember,
  sessionFromMember,
  type FlextvMember
} from "./auth";
import { FlextvUnavailableError } from "./client";

/**
 * FLEXTV's answers (server/services/auth, server/routes/api/guest, server/routes/api/oauth of FLEXTV's web repository)
 * mapped to what Ssumnation's auth needs. The bodies are the shapes FLEXTV sends.
 */

const token = { accessToken: "a".repeat(128), refreshToken: "r".repeat(128), accessToken_ttl: 172_000, refreshToken_ttl: 2_590_000 };
const profile = { id: 601924, loginId: "viewer01", nickname: "시청자", thumbUrl: "https://static.flextv.co.kr/p.png", memberDiv: 1, status: 1 };
const member = (over: Partial<FlextvMember> = {}): FlextvMember => ({ id: 1, loginId: "viewer01", nickname: "시청자", thumbUrl: null, memberDiv: 1, status: 1, ...over });

describe("FLEXTV sign-in", () => {
  it("signs in with the tokens and the member FLEXTV returns, the profile over the member row", () => {
    const outcome = mapSignIn({ status: 200, data: { ...profile, token, member: { id: 601924, loginId: "viewer01", nickname: "옛 닉네임", status: 1, memberDiv: 1, password: "$2b$12$hash" } } });
    expect(outcome).toEqual({
      kind: "OK",
      tokens: { accessToken: token.accessToken, refreshToken: token.refreshToken, accessTtl: 172_000, refreshTtl: 2_590_000 },
      member: { id: 601924, loginId: "viewer01", nickname: "시청자", thumbUrl: "https://static.flextv.co.kr/p.png", memberDiv: 1, status: 1 }
    });
    // The member row's password hash is never kept.
    expect(JSON.stringify(outcome)).not.toContain("$2b$");
  });

  it("tells a wrong password, the 10-minute lock, an unknown 아이디 and a blocked member apart", () => {
    expect(mapSignIn({ status: 401, data: { error: 2, msg: "로그인에 1회 실패하였습니다.", count: 1 } })).toEqual({ kind: "WRONG_PASSWORD" });
    expect(mapSignIn({ status: 401, data: { error: 1, msg: "10분내 로그인 시도 20번 실패로 10분 후 다시 시도해주십시오." } })).toEqual({ kind: "TOO_MANY_ATTEMPTS" });
    expect(mapSignIn({ status: 401, data: null })).toEqual({ kind: "NOT_FOUND" });
    expect(mapSignIn({ status: 423, data: null })).toEqual({ kind: "BLOCKED" });
  });

  it("answers a social account FLEXTV does not know as a new member", () => {
    expect(mapSignIn({ status: 200, data: { isNew: true } })).toEqual({ kind: "NEW_MEMBER" });
  });

  it("treats FLEXTV's own failures as unavailable, not as the member's mistake", () => {
    expect(() => mapSignIn({ status: 401, data: { msg: "로그인 처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요." } })).toThrow(FlextvUnavailableError);
    expect(() => mapSignIn({ status: 200, data: { ...profile } })).toThrow(FlextvUnavailableError);
    expect(() => mapSignIn({ status: 500, data: "Internal Server Error" })).toThrow(FlextvUnavailableError);
  });
});

describe("FLEXTV sign-up", () => {
  const cookies = ["flx_oauth_access=; Path=/", `flx_oauth_access=${token.accessToken}; Max-Age=172800; Path=/`, `flx_oauth_refresh=${token.refreshToken}; Max-Age=2592000; Path=/`];

  it("creates the member and takes the tokens from FLEXTV's cookies", () => {
    expect(mapSignUp({ status: 200, data: profile, setCookies: cookies })).toEqual({
      kind: "CREATED",
      member: { id: 601924, loginId: "viewer01", nickname: "시청자", thumbUrl: "https://static.flextv.co.kr/p.png", memberDiv: 1, status: 1 },
      tokens: { accessToken: token.accessToken, refreshToken: token.refreshToken, accessTtl: 172_800, refreshTtl: 2_592_000 }
    });
    expect(mapSignUp({ status: 200, data: profile, setCookies: [] })).toMatchObject({ kind: "CREATED", tokens: null });
  });

  it("maps FLEXTV's refusal messages", () => {
    const refused = (message: string) => mapSignUp({ status: 400, data: { message }, setCookies: [] }).kind;
    expect(refused("이미 가입된 회원입니다.")).toBe("LOGIN_ID_TAKEN");
    expect(refused("이미 존재하는 닉네임입니다.")).toBe("NICKNAME_TAKEN");
    expect(refused("금지된 단어입니다.")).toBe("FORBIDDEN_WORD");
    expect(refused("접근 불가 아이피입니다.")).toBe("BLOCKED");
    expect(refused("Invalid Token")).toBe("PROVIDER_REFUSED");
    expect(refused("아이디는 6~15자 영문, 숫자입니다.")).toBe("INVALID");
    expect(mapSignUp({ status: 401, data: null, setCookies: [] }).kind).toBe("PROVIDER_REFUSED");
    expect(() => mapSignUp({ status: 502, data: null, setCookies: [] })).toThrow(FlextvUnavailableError);
  });
});

describe("FLEXTV 중복 확인", () => {
  it("reads the 아이디 check, where a 정지 or 탈퇴 member keeps the 아이디", () => {
    expect(mapLoginIdCheck({ status: 200, data: "ok" })).toBe("AVAILABLE");
    for (const answer of ["overlap", "stoped", "secession"]) expect(mapLoginIdCheck({ status: 200, data: answer })).toBe("TAKEN");
    expect(() => mapLoginIdCheck({ status: 200, data: "?" })).toThrow(FlextvUnavailableError);
  });

  it("reads the nickname check", () => {
    expect(mapNicknameCheck({ status: 200, data: "ok" })).toBe("AVAILABLE");
    expect(mapNicknameCheck({ status: 200, data: "overlap" })).toBe("TAKEN");
    expect(mapNicknameCheck({ status: 200, data: "error" })).toBe("INVALID");
    expect(() => mapNicknameCheck({ status: 500, data: null })).toThrow(FlextvUnavailableError);
  });
});

describe("FLEXTV refresh", () => {
  it("keeps the refresh token when FLEXTV renews only the access token", () => {
    expect(mapRefresh({ status: 200, data: { access_token: "n".repeat(128), accessToken_ttl: 100 } }, "old-refresh-token")).toEqual({
      kind: "OK",
      tokens: { accessToken: "n".repeat(128), refreshToken: "old-refresh-token", accessTtl: 100, refreshTtl: 2_592_000 }
    });
  });

  it("ends the session when FLEXTV no longer accepts the refresh token", () => {
    expect(mapRefresh({ status: 200, data: { msg: "ERROR" } }, "old")).toEqual({ kind: "INVALID" });
    expect(mapRefresh({ status: 200, data: { status: 4, result: "Error" } }, "old")).toEqual({ kind: "INVALID" });
    expect(mapRefresh({ status: 401, data: null }, "old")).toEqual({ kind: "INVALID" });
    expect(() => mapRefresh({ status: 503, data: null }, "old")).toThrow(FlextvUnavailableError);
  });
});

describe("FLEXTV member → session", () => {
  it("reads only what the session needs, and an https thumbnail", () => {
    expect(readMember({ ...profile, thumbUrl: "http://plain.example/p.png", ci: "secret", luv: 100 })).toEqual({ ...profile, thumbUrl: null });
    expect(readMember({ ...profile, id: "abc" })).toBeNull();
    expect(readMember({ id: 1, nickname: "x" })).toBeNull();
  });

  it("makes every member a Supporter and FLEXTV's broadcasters Creators", () => {
    expect(sessionFromMember(member())?.roles).toEqual(["SUPPORTER"]);
    expect(sessionFromMember(member({ memberDiv: 2 }))?.roles).toEqual(["SUPPORTER", "CREATOR"]);
    expect(sessionFromMember(member({ memberDiv: 3 }))?.roles).toEqual(["SUPPORTER", "CREATOR"]);
    expect(sessionFromMember(member({ id: 77, loginId: "kabc123" }))).toMatchObject({ userId: "77", ssumnationId: "kabc123" });
  });

  it("gives no session to a 휴면 · 정지 · 탈퇴 member", () => {
    for (const status of [3, 4, 8]) expect(sessionFromMember(member({ status }))).toBeNull();
  });
});

describe("device context", () => {
  it("sends FLEXTV the member's first forwarded IP and the device kind", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    expect(deviceContextFrom(headers)).toEqual({ clientIp: "203.0.113.7", device: "MOBILEWEB", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    expect(deviceContextFrom(new Headers({ "user-agent": "Mozilla/5.0 (Windows NT 10.0)" }))).toEqual({ clientIp: null, device: "PCWEB", userAgent: "Mozilla/5.0 (Windows NT 10.0)" });
  });
});
