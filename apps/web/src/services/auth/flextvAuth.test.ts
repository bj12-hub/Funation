import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 로그인 · 회원가입 · 세션 on the FLEXTV backend (docs/development/flextv-backend.md), run against a stubbed FLEXTV API:
 * what Ssumnation sends, what it keeps in its cookies, and what the screens get back.
 */

const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => void (value ? jar.set(name, { value, options }) : jar.delete(name)),
    delete: (name: string) => void jar.delete(name)
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_AUTH: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));

const ACCESS = "a".repeat(128);
const REFRESH = "r".repeat(128);
const profile = { id: 601924, loginId: "viewer01", nickname: "시청자", thumbUrl: null, memberDiv: 1, status: 1 };
const signInBody = { ...profile, token: { accessToken: ACCESS, refreshToken: REFRESH, accessToken_ttl: 172_800, refreshToken_ttl: 2_592_000 }, member: profile };
const tokenCookies = [`flx_oauth_access=${ACCESS}; Max-Age=172800; Path=/`, `flx_oauth_refresh=${REFRESH}; Max-Age=2592000; Path=/`];
const agreements = { service: true, privacy: true, marketing: false };

type Call = { url: string; method: string; body: Record<string, unknown> | null; headers: Headers };
let calls: Call[] = [];
/** Answers FLEXTV calls by path; an unknown path fails the test. */
function stubFlextv(routes: Record<string, () => Response | Promise<Response>>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname;
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) });
      const route = routes[path];
      if (!route) throw new Error(`unexpected FLEXTV call ${path}`);
      return route();
    })
  );
}
const json = (body: unknown, status = 200, headers: [string, string][] = []) => new Response(JSON.stringify(body), { status, headers: [["Content-Type", "application/json"], ...headers] });
const text = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  jar.clear();
  calls = [];
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvSessions;
  delete g.__ssumnationRevokedTokens;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("로그인 (FLEXTV)", () => {
  it("signs in with the FLEXTV 아이디 and keeps FLEXTV's tokens in httpOnly cookies", async () => {
    stubFlextv({ "/v2/api/auth/signin": () => json(signInBody) });
    const { login } = await import("./login");
    const { getSession } = await import("@/lib/session");

    expect(await login({ identifier: " viewer01 ", password: "pass!word1", keepSignedIn: true })).toEqual({ status: "SUCCESS" });
    expect(calls[0].body).toEqual({ loginId: "viewer01", password: "pass!word1", loginKeep: true, saveId: false, device: "PCWEB" });
    expect(calls[0].headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(jar.get("ssumnation_session")).toMatchObject({ value: ACCESS, options: { httpOnly: true, maxAge: 172_800 } });
    expect(jar.get("ssumnation_refresh")?.value).toMatch(new RegExp(`^1\\.1\\.\\d+\\.${REFRESH}$`));

    // The member is known from the sign-in: the next page does not ask FLEXTV again.
    expect(await getSession()).toEqual({ userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] });
    expect(calls).toHaveLength(1);
  });

  it("maps FLEXTV's refusals and sets no cookie", async () => {
    const { login } = await import("./login");
    const attempt = async (response: () => Response) => {
      stubFlextv({ "/v2/api/auth/signin": response });
      return (await login({ identifier: "viewer01", password: "x", keepSignedIn: false })).status;
    };
    expect(await attempt(() => json({ error: 2, msg: "로그인에 1회 실패하였습니다.", count: 1 }, 401))).toBe("WRONG_PASSWORD");
    expect(await attempt(() => json({ error: 1, msg: "10분내 …" }, 401))).toBe("TOO_MANY_ATTEMPTS");
    expect(await attempt(() => new Response(null, { status: 401 }))).toBe("UNKNOWN_ID");
    expect(await attempt(() => new Response(null, { status: 423 }))).toBe("SUSPENDED");
    expect(jar.size).toBe(0);
  });

  it("fails as a temporary error when FLEXTV cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const { login } = await import("./login");
    await expect(login({ identifier: "viewer01", password: "x", keepSignedIn: false })).rejects.toThrow();
    expect(jar.size).toBe(0);
  });
});

describe("세션 (FLEXTV)", () => {
  it("asks FLEXTV whose token it is, once per few seconds", async () => {
    stubFlextv({ "/api/my/profile": () => json({ luv: 0, numMsg: 0, profile: { ...profile, memberDiv: 2 } }) });
    jar.set("ssumnation_session", { value: ACCESS });
    const { getSession, getCreatorSession } = await import("@/lib/session");
    expect((await getSession())?.roles).toEqual(["SUPPORTER", "CREATOR"]);
    expect(await getCreatorSession()).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${ACCESS}`);
  });

  it("is signed out when FLEXTV no longer accepts the token, or cannot be reached", async () => {
    stubFlextv({ "/api/my/profile": () => new Response(null, { status: 401 }) });
    jar.set("ssumnation_session", { value: ACCESS });
    const { getSession } = await import("@/lib/session");
    expect(await getSession()).toBeNull();

    vi.resetModules();
    delete (globalThis as Record<string, unknown>).__ssumnationFlextvSessions;
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFlextv({ "/api/my/profile": () => new Response(null, { status: 500 }) });
    expect(await (await import("@/lib/session")).getSession()).toBeNull();
  });

  it("logs out on this site only, by clearing both cookies", async () => {
    jar.set("ssumnation_session", { value: ACCESS });
    jar.set("ssumnation_refresh", { value: `1.0.1.${REFRESH}` });
    stubFlextv({});
    const { endSession } = await import("@/lib/session");
    await endSession();
    expect(jar.size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("회원가입 (FLEXTV)", () => {
  const request = { loginId: "newbie01", password: "pass!word1", nickname: "새회원", agreements };

  it("creates a FLEXTV member and signs them in with the tokens of the sign-up", async () => {
    stubFlextv({ "/api/auth/signup": () => json({ ...profile, id: 700001, loginId: "newbie01", nickname: "새회원" }, 200, tokenCookies.map((c) => ["Set-Cookie", c] as [string, string])) });
    const { createFlextvAccount } = await import("./flextvSignup");
    const { getSession } = await import("@/lib/session");
    expect(await createFlextvAccount(request)).toEqual({ status: "CREATED", signedIn: true });
    expect(calls[0].body).toEqual({ loginId: "newbie01", nickname: "새회원", password: "pass!word1", device: "PCWEB" });
    expect(jar.get("ssumnation_session")?.value).toBe(ACCESS);
    expect((await getSession())?.userId).toBe("700001");
  });

  it("signs in for the tokens when the sign-up sent none", async () => {
    stubFlextv({ "/api/auth/signup": () => json(profile), "/v2/api/auth/signin": () => json(signInBody) });
    const { createFlextvAccount } = await import("./flextvSignup");
    expect(await createFlextvAccount(request)).toEqual({ status: "CREATED", signedIn: true });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/api/auth/signup", "/v2/api/auth/signin"]);
  });

  it("refuses before asking FLEXTV: a required agreement missing, FLEXTV's rules, the reserved 'flex'", async () => {
    stubFlextv({});
    const { createFlextvAccount } = await import("./flextvSignup");
    for (const bad of [
      { ...request, agreements: { ...agreements, privacy: false } },
      { ...request, loginId: "12345678" },
      { ...request, password: "password1" },
      { ...request, nickname: "열한글자닉네임입니다요" },
      { ...request, loginId: "myflexid" }
    ]) {
      expect(await createFlextvAccount(bad)).toEqual({ status: "INVALID" });
    }
    expect(calls).toHaveLength(0);
  });

  it("passes FLEXTV's refusals on", async () => {
    const { createFlextvAccount } = await import("./flextvSignup");
    stubFlextv({ "/api/auth/signup": () => json({ message: "이미 존재하는 닉네임입니다." }, 400) });
    expect(await createFlextvAccount(request)).toEqual({ status: "NICKNAME_TAKEN" });
    stubFlextv({ "/api/auth/signup": () => json({ message: "금지된 단어입니다." }, 400) });
    expect(await createFlextvAccount(request)).toEqual({ status: "FORBIDDEN" });
    expect(jar.size).toBe(0);
  });

  it("checks the 아이디 with FLEXTV, the reserved word without it", async () => {
    stubFlextv({ "/api/guest/loginId/taken01": () => text("overlap"), "/api/guest/loginId/free0001": () => text("ok") });
    const { checkLoginIdAvailability } = await import("./flextvSignup");
    expect(await checkLoginIdAvailability("myflexid")).toEqual({ available: false, reason: "FORBIDDEN" });
    expect(await checkLoginIdAvailability("abc")).toEqual({ available: false, reason: "INVALID" });
    expect(await checkLoginIdAvailability("taken01")).toEqual({ available: false, reason: "DUPLICATE" });
    expect(await checkLoginIdAvailability("free0001")).toEqual({ available: true });
    expect(calls).toHaveLength(2);
  });
});

describe("간편 가입 (FLEXTV)", () => {
  it("expires without the pending social sign-in", async () => {
    stubFlextv({});
    const { completeSocialSignup } = await import("./flextvSignup");
    expect(await completeSocialSignup({ nickname: "새회원", agreements })).toEqual({ status: "EXPIRED" });
  });

  it("signs the social account up with the nickname, then goes where the member was heading", async () => {
    const { encodeSocialSignup } = await import("@/lib/flextv/social");
    jar.set("ssumnation_social_signup", { value: encodeSocialSignup({ provider: "kakao", next: "/creators/1", token: "kakao-access-token" }) });
    stubFlextv({ "/api/auth/signup/oauth/kakao": () => json(profile, 200, tokenCookies.map((c) => ["Set-Cookie", c] as [string, string])) });
    const { completeSocialSignup } = await import("./flextvSignup");
    expect(await completeSocialSignup({ nickname: "새회원", agreements })).toEqual({ status: "CREATED", next: "/creators/1" });
    expect(calls[0].body).toEqual({ accessToken: "kakao-access-token", nickname: "새회원", device: "PCWEB" });
    expect(jar.has("ssumnation_social_signup")).toBe(false);
    expect(jar.get("ssumnation_session")?.value).toBe(ACCESS);
  });

  it("sends an existing member to sign in, and a refused token back to the start", async () => {
    const { encodeSocialSignup } = await import("@/lib/flextv/social");
    const pending = encodeSocialSignup({ provider: "naver", next: "/", token: "naver-access-token" });
    const { completeSocialSignup } = await import("./flextvSignup");
    jar.set("ssumnation_social_signup", { value: pending });
    stubFlextv({ "/api/auth/signup/oauth/naver": () => json({ message: "이미 가입된 회원입니다." }, 400) });
    expect(await completeSocialSignup({ nickname: "새회원", agreements })).toEqual({ status: "ALREADY_MEMBER" });
    stubFlextv({ "/api/auth/signup/oauth/naver": () => new Response(null, { status: 401 }) });
    expect(await completeSocialSignup({ nickname: "새회원", agreements })).toEqual({ status: "EXPIRED" });
    expect(jar.has("ssumnation_social_signup")).toBe(false);
  });
});
