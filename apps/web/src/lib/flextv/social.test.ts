import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeUrl,
  callbackUrl,
  configuredProviders,
  decodeOAuthState,
  decodeSocialSignup,
  encodeOAuthState,
  encodeSocialSignup,
  exchangeCode,
  isConfiguredProvider,
  publicOrigin
} from "./social";

/** 간편 로그인 through FLEXTV's apps (lib/flextv/social.ts). */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const configure = () => {
  vi.stubEnv("KAKAO_REST_API_KEY", "kakao-key");
  vi.stubEnv("KAKAO_CLIENT_SECRET", "");
  vi.stubEnv("NAVER_CLIENT_ID", "naver-id");
  vi.stubEnv("NAVER_CLIENT_SECRET", "naver-secret");
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
};

describe("providers", () => {
  it("offers a provider only when its app is configured (Naver and Google need their secret)", () => {
    configure();
    expect(configuredProviders()).toEqual(["kakao", "naver"]);
    expect(isConfiguredProvider("google")).toBe(false);
    expect(isConfiguredProvider("twitch")).toBe(false);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    expect(configuredProviders()).toEqual(["kakao", "naver", "google"]);
  });

  it("asks each provider for a code with the state and the registered callback", () => {
    configure();
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    const redirectUri = callbackUrl("https://ssumnation.test", "kakao");
    const kakao = new URL(authorizeUrl("kakao", { state: "s-1", redirectUri }));
    expect(kakao.origin + kakao.pathname).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(Object.fromEntries(kakao.searchParams)).toEqual({ response_type: "code", client_id: "kakao-key", redirect_uri: "https://ssumnation.test/auth/kakao/callback", state: "s-1" });
    const google = new URL(authorizeUrl("google", { state: "s-2", redirectUri: callbackUrl("https://ssumnation.test", "google") }));
    expect(google.searchParams.get("scope")).toBe("openid profile");
    expect(google.searchParams.has("client_secret")).toBe(false);
  });

  it("exchanges the code on the server: Kakao's access token, Google's ID token", async () => {
    configure();
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: "kakao-access", id_token: "google.id.token" })));
    vi.stubGlobal("fetch", fetch);
    expect(await exchangeCode("kakao", { code: "c", state: "s", redirectUri: "https://x.test/cb" })).toBe("kakao-access");
    expect(await exchangeCode("google", { code: "c", state: "s", redirectUri: "https://x.test/cb" })).toBe("google.id.token");
    const googleBody = new URLSearchParams(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(Object.fromEntries(googleBody)).toEqual({ grant_type: "authorization_code", client_id: "google-id", redirect_uri: "https://x.test/cb", code: "c", client_secret: "google-secret" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    expect(await exchangeCode("naver", { code: "c", state: "s", redirectUri: "https://x.test/cb" })).toBeNull();
  });
});

describe("flow cookies", () => {
  it("round-trips the login state and refuses anything else", () => {
    const state = { provider: "naver" as const, state: crypto.randomUUID(), next: "/creators/1?tab=home" };
    expect(decodeOAuthState(encodeOAuthState(state))).toEqual(state);
    for (const bad of [undefined, "", "twitch.0123456789abcdef.%2F", "naver.short.%2F", "naver.0123456789abcdef.%E0%A4%A"]) expect(decodeOAuthState(bad)).toBeNull();
  });

  it("round-trips a pending social sign-up, also with dots in the next path and the token", () => {
    const pending = { provider: "google" as const, next: "/support/notices/1.2?a=b.c", token: "eyJhbGciOi.JIUzI1NiJ9.sig-_+/=" };
    expect(decodeSocialSignup(encodeSocialSignup(pending))).toEqual(pending);
    expect(decodeSocialSignup("google.%2F.short")).toBeNull();
    expect(decodeSocialSignup("apple.%2F.0123456789abc")).toBeNull();
    expect(decodeSocialSignup("google")).toBeNull();
  });
});

describe("publicOrigin", () => {
  const request = (headers: Record<string, string>) => ({ headers: new Headers(headers), nextUrl: { origin: "http://10.0.0.5:3000", protocol: "http:" } });

  it("uses the address the browser used behind a proxy", () => {
    expect(publicOrigin(request({ "x-forwarded-host": "ssumnation.test", "x-forwarded-proto": "https", host: "10.0.0.5:3000" }))).toBe("https://ssumnation.test");
    expect(publicOrigin(request({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });

  it("falls back to the request's own origin for a malformed host", () => {
    expect(publicOrigin(request({ "x-forwarded-host": "evil.test/path", host: "x" }))).toBe("http://10.0.0.5:3000");
  });
});
