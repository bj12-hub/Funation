import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 7: 마이페이지's changes on FLEXTV, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
const session = { revoked: 0, forgotten: 0 };
vi.mock("@/lib/session", () => ({
  getFlextvAccessToken: async () => "member-token",
  forgetFlextvSession: async () => void session.forgotten++,
  revokeSession: async () => void session.revoked++
}));

let state: { nickname: string; thumbUrl: string; taken: string[]; password: string };
let puts: FormData[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (body: string) => new Response(body, { status: 200 });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  session.revoked = 0;
  session.forgotten = 0;
  puts = [];
  state = { nickname: "시청자", thumbUrl: "https://cdn.flextv.test/old.png", taken: ["방송인"], password: "abc123!!" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      if (u.pathname === "/api/my/profile" && (init.method ?? "GET") === "GET") return json({ luv: 0, profile: { loginId: "viewer01", nickname: state.nickname, thumbUrl: state.thumbUrl } });
      if (u.pathname === "/api/my/profile" && init.method === "PUT") {
        const form = init.body as FormData;
        puts.push(form);
        const nickname = form.get("nickname");
        if (typeof nickname === "string") {
          const value = decodeURIComponent(nickname);
          if (value.includes("욕")) return text("금지된 단어는 입력할 수 없습니다.");
          if (state.taken.includes(value)) return text("동일한 닉네임이 존재합니다.");
          state.nickname = value;
        }
        if (form.get("image")) state.thumbUrl = "https://cdn.flextv.test/new.png";
        return text("OK");
      }
      if (u.pathname.startsWith("/api/guest/nickname/")) return text(state.taken.includes(decodeURIComponent(u.pathname.split("/").pop()!)) ? "overlap" : "ok");
      if (u.pathname === "/api/oauth/password") {
        const { prePassword, password } = JSON.parse(String(init.body));
        if (prePassword !== state.password) return json({ status: 3, msg: "Unauthorized" });
        if (prePassword === password) return json({ status: 4, msg: "Unauthorized" });
        state.password = password;
        return json({ accessToken: "new-access", refreshToken: "new-refresh" });
      }
      throw new Error(`unexpected FLEXTV call ${init.method ?? "GET"} ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("닉네임", () => {
  it("checks FLEXTV's rule here, then asks FLEXTV", async () => {
    const { flextvCheckNickname, flextvChangeNickname } = await import("./flextvAccount");
    expect(await flextvCheckNickname("가")).toEqual({ status: "INVALID" });
    expect(await flextvCheckNickname("열한글자닉네임입니다요")).toEqual({ status: "INVALID" });
    expect(await flextvCheckNickname("방송인")).toEqual({ status: "DUPLICATE" });
    expect(await flextvCheckNickname("새닉네임")).toEqual({ status: "AVAILABLE" });
    expect(await flextvChangeNickname("욕설닉")).toEqual({ status: "FORBIDDEN" });
    expect(await flextvChangeNickname("방송인")).toEqual({ status: "DUPLICATE" });
    expect(await flextvChangeNickname("새닉네임")).toEqual({ status: "CHANGED", value: "새닉네임" });
    expect(state.nickname).toBe("새닉네임");
    // The session's nickname is asked again on the next page.
    expect(session.forgotten).toBe(1);
  });

  it("sends nothing for a value FLEXTV's rule refuses", async () => {
    const { flextvChangeNickname } = await import("./flextvAccount");
    expect(await flextvChangeNickname("a b")).toEqual({ status: "INVALID" });
    expect(puts).toHaveLength(0);
  });
});

describe("프로필 사진", () => {
  it("sends the picture to FLEXTV and shows FLEXTV's new address", async () => {
    const { flextvUploadProfilePhoto } = await import("./flextvAccount");
    const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "me.png", { type: "image/png" });
    expect(await flextvUploadProfilePhoto(photo)).toEqual({ status: "UPLOADED", avatarUrl: "https://cdn.flextv.test/new.png" });
    expect(puts[0].get("image")).toBeInstanceOf(Blob);
    expect(puts[0].get("nickname")).toBeNull();
  });
});

describe("비밀번호", () => {
  it("checks FLEXTV's rule and the confirmation here, then FLEXTV's answer, and ends the session after a change", async () => {
    const { flextvChangePassword } = await import("./flextvAccount");
    expect(await flextvChangePassword({ current: "abc123!!", next: "short1!", confirm: "short1!" })).toEqual({ status: "INVALID" });
    expect(await flextvChangePassword({ current: "abc123!!", next: "newpass12!", confirm: "newpass12?" })).toEqual({ status: "MISMATCH" });
    expect(await flextvChangePassword({ current: "wrong123!", next: "newpass12!", confirm: "newpass12!" })).toEqual({ status: "WRONG_CURRENT" });
    expect(await flextvChangePassword({ current: "abc123!!", next: "abc123!!", confirm: "abc123!!" })).toEqual({ status: "REUSED" });
    expect(session.revoked).toBe(0);
    expect(await flextvChangePassword({ current: "abc123!!", next: "newpass12!", confirm: "newpass12!" })).toEqual({ status: "CHANGED" });
    expect(session.revoked).toBe(1);
  });
});
