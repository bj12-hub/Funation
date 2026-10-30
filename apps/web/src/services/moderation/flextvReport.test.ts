import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 10: 방송 신고 in a FLEXTV channel's room, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
let signedIn: boolean;
vi.mock("@/lib/session", () => ({
  getSession: async () => (signedIn ? { userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] } : null),
  getFlextvAccessToken: async () => (signedIn ? "member-token" : null)
}));

let posts: { auth: string | null; fields: Record<string, string> }[];
let answer: () => Response;
let down: boolean;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvReportRequests;
  signedIn = true;
  posts = [];
  down = false;
  answer = () => json({ result: true, data: { id: 55 } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      if (down) return new Response("Bad Gateway", { status: 502 });
      if (u.pathname === "/api/guest/refcode/bjreportCategory") return json([{ key: 1, value: 1, text: "음란 · 선정성" }, { key: 2, value: 2, text: "욕설 · 비하" }]);
      if (u.pathname === "/api/channels/3021/profile") return json({ id: 3021, name: "플렉스방송국", isInLive: true, owner: { id: 601900, loginId: "bj01", nickname: "방송인", PI: "Y" } });
      if (u.pathname === "/api/channels/9999/profile") return new Response("INVALID_CHANNEL_ID", { status: 400 });
      if (u.pathname === "/api/cs/declaration-post") {
        const form = init.body as FormData;
        posts.push({ auth: new Headers(init.headers).get("authorization"), fields: Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) });
        return answer();
      }
      throw new Error(`unexpected FLEXTV call ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = () => import("./flextvReport");
const report = (over: Record<string, unknown> = {}) => ({ channelId: "3021", category: "2", content: "  방송 중 욕설이 계속 나와요  ", requestId: crypto.randomUUID(), ...over });

describe("방송 신고", () => {
  it("lists FLEXTV's 신고 유형, and none when FLEXTV does not answer", async () => {
    const { flextvReportCategories } = await load();
    expect(await flextvReportCategories()).toEqual([
      { value: "1", label: "음란 · 선정성" },
      { value: "2", label: "욕설 · 비하" }
    ]);
    down = true;
    expect(await flextvReportCategories()).toBeNull();
  });

  it("sends FLEXTV's 신고 form for the streamer, looked up on the server", async () => {
    const { reportFlextvBroadcast } = await load();
    expect(await reportFlextvBroadcast(report())).toEqual({ status: "REPORTED" });
    expect(posts).toEqual([
      { auth: "Bearer member-token", fields: { title: "[방송 신고] 방송인", category: "2", content: "방송 중 욕설이 계속 나와요", targetId: "601900", reportTypes: "1" } }
    ]);
  });

  it("is one 신고 per request id, while a refused one may be sent again", async () => {
    const { reportFlextvBroadcast } = await load();
    const once = report();
    await Promise.all([reportFlextvBroadcast(once), reportFlextvBroadcast(once)]);
    expect(posts).toHaveLength(1);
    answer = () => json({ result: false, data: "정지된 회원입니다." });
    const refused = report();
    expect(await reportFlextvBroadcast(refused)).toEqual({ status: "INVALID", message: "정지된 회원입니다." });
    expect(await reportFlextvBroadcast(refused)).toEqual({ status: "INVALID", message: "정지된 회원입니다." });
    expect(posts).toHaveLength(3);
  });

  it("checks what it can before FLEXTV is asked", async () => {
    const { reportFlextvBroadcast } = await load();
    expect(await reportFlextvBroadcast(report({ category: "7" }))).toEqual({ status: "INVALID", message: "신고 유형을 골라 주세요." });
    expect(await reportFlextvBroadcast(report({ content: " " }))).toMatchObject({ status: "INVALID" });
    expect(await reportFlextvBroadcast(report({ content: "가".repeat(1001) }))).toMatchObject({ status: "INVALID" });
    expect(await reportFlextvBroadcast(report({ channelId: "../1" }))).toMatchObject({ status: "INVALID" });
    expect(await reportFlextvBroadcast(report({ channelId: "9999" }))).toEqual({ status: "INVALID", message: "이 채널을 찾을 수 없어요." });
    expect(posts).toEqual([]);
    signedIn = false;
    expect(await reportFlextvBroadcast(report())).toEqual({ status: "UNAUTHORIZED" });
  });
});
