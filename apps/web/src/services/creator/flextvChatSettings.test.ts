import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 9: the studio's 채팅 관리 on FLEXTV, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

const people: Record<string, number> = { helper01: 601950, viewer01: 601924, staff01: 1 };
let state: {
  notice: string | null;
  rule: string | null;
  words: { id: number; text: string }[];
  managers: number[];
  blacklist: number[];
  youtube: Record<string, unknown> | null;
  calls: string[];
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (body: string, status = 200) => new Response(body, { status });
const loginOf = (id: number) => Object.entries(people).find(([, v]) => v === id)![0];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  member.creator = true;
  state = { notice: "8시에 시작해요", rule: null, words: [{ id: 5, text: "광고" }], managers: [601950], blacklist: [], youtube: null, calls: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      if (method !== "GET") state.calls.push(`${method} ${u.pathname}`);
      const p = u.pathname;
      if (p === "/api/my/channel/profile") return json({ id: 3021, name: "방송인의 방송국", broadcastNotice: state.notice, broadcastRule: state.rule });
      if (p === "/api/my/channel/broadcast/3021/channel-notice") return (state.notice = body.message || null), text("OK");
      if (p === "/api/my/channel/broadcast/3021/rule") return (state.rule = body.message || null), text("OK");
      if (p === "/api/my/channel/broadcast/3021/ban-word-list") return json(state.words.map((w) => ({ ...w, channelId: 3021 })));
      if (p === "/api/my/channel/broadcast/3021/ban-word-add") return state.words.push({ id: 6, text: body.message }), text("ok");
      if (p.startsWith("/api/my/channel/broadcast/3021/ban-word-del/")) return (state.words = state.words.filter((w) => String(w.id) !== p.split("/").pop())), text("ok");
      const list = /^\/api\/channels\/3021\/(managers|blacklist)(?:\/(\d+))?$/.exec(p);
      if (list) {
        const which = list[1] as "managers" | "blacklist";
        if (method === "GET") return json(state[which].map((id) => ({ channelId: 3021, memberId: id, createdAt: "2026-10-20T03:00:00.000Z", member: { id, loginId: loginOf(id), nickname: loginOf(id) } })));
        if (method === "DELETE") return (state[which] = state[which].filter((id) => id !== Number(list[2]))), text("OK");
        const id = people[body.loginId];
        if (!id) return text("존재하지 않는 사용자 입니다.", 400);
        if (id === 1) return text("Bad Request", 400);
        if (state[which].includes(id)) return text(which === "managers" ? "이미 매니저로 등록되었습니다." : "이미 블랙리스트로 등록되었습니다.", 400);
        return state[which].push(id), text("OK");
      }
      if (p === "/api/my/channel/youtube-chat-link") {
        if (method === "GET") return state.youtube ? json(state.youtube) : new Response(null, { status: 204 });
        if (method === "DELETE") return (state.youtube = null), text("OK");
        if (!/youtube\.com\/@/.test(body.url)) return text("유효한 유튜브 채널 주소가 아닙니다.", 400);
        state.youtube = { kind: "handle", value: "@bj", raw: body.url, notification: true, savedAt: 1793000000000 };
        return json({ kind: "handle", value: "@bj", raw: body.url });
      }
      if (p === "/api/my/channel/youtube-chat-link/notification") {
        if (!state.youtube) return text("연결된 유튜브 채널이 없습니다.", 400);
        state.youtube.notification = body.notification;
        return text("OK");
      }
      throw new Error(`unexpected FLEXTV call ${method} ${p}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = () => import("./flextvChatSettings");

describe("the page", () => {
  it("shows the channel's chat settings, members by 아이디 only", async () => {
    const view = (await (await load()).getFlextvChatSettings())!;
    expect(view).toEqual({
      notice: "8시에 시작해요",
      rule: "",
      banWords: [{ id: "5", word: "광고" }],
      managers: [{ loginId: "helper01", nickname: "helper01", since: "2026-10-20T03:00:00.000Z" }],
      blacklist: [],
      youtube: null
    });
    expect(JSON.stringify(view)).not.toContain("601950");
  });

  it("is not shown without the streamer's session", async () => {
    member.creator = false;
    const m = await load();
    expect(await m.getFlextvChatSettings()).toBeNull();
    expect(await m.saveFlextvChatText("notice", "x")).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("공지 · 규칙 · 금지어", () => {
  it("saves and takes away the 공지, within FLEXTV's 250 characters", async () => {
    const m = await load();
    expect(await m.saveFlextvChatText("rule", " 욕설 금지 ")).toEqual({ status: "SAVED" });
    expect(state.rule).toBe("욕설 금지");
    expect(await m.saveFlextvChatText("notice", "")).toEqual({ status: "SAVED" });
    expect(state.notice).toBeNull();
    expect(await m.saveFlextvChatText("notice", "가".repeat(251))).toMatchObject({ status: "INVALID" });
    expect(await m.saveFlextvChatText("title", "x")).toMatchObject({ status: "INVALID" });
  });

  it("adds a 금지어 once and removes it by its row", async () => {
    const m = await load();
    expect(await m.addFlextvBanWord(" 도배 ")).toEqual({ status: "SAVED" });
    expect(await m.addFlextvBanWord("광고")).toEqual({ status: "INVALID", message: "이미 등록된 금지어예요." });
    expect(await m.addFlextvBanWord("가".repeat(31))).toMatchObject({ status: "INVALID" });
    expect(state.words.map((w) => w.text)).toEqual(["광고", "도배"]);
    expect(await m.removeFlextvBanWord("5")).toEqual({ status: "SAVED" });
    expect(await m.removeFlextvBanWord("../5")).toMatchObject({ status: "INVALID" });
    expect(state.words.map((w) => w.text)).toEqual(["도배"]);
  });
});

describe("매니저 · 블랙리스트", () => {
  it("adds by 아이디 and says why FLEXTV would not", async () => {
    const m = await load();
    expect(await m.addFlextvChatMember("blacklist", "viewer01")).toEqual({ status: "SAVED" });
    expect(state.blacklist).toEqual([601924]);
    expect(await m.addFlextvChatMember("managers", "helper01")).toEqual({ status: "INVALID", message: "이미 매니저에 있어요." });
    expect(await m.addFlextvChatMember("managers", "nobody")).toEqual({ status: "INVALID", message: "그 아이디의 FLEXTV 회원을 찾지 못했어요." });
    expect(await m.addFlextvChatMember("managers", "staff01")).toMatchObject({ status: "INVALID", message: "이 회원은 매니저에 넣을 수 없어요." });
    // The streamer themself is not sent to FLEXTV.
    expect(await m.addFlextvChatMember("managers", "BJ01")).toEqual({ status: "INVALID", message: "나 자신은 등록할 수 없어요." });
    expect(await m.addFlextvChatMember("owners", "viewer01")).toMatchObject({ status: "INVALID" });
  });

  it("removes by 아이디, FLEXTV's member number looked up on the server", async () => {
    const m = await load();
    expect(await m.removeFlextvChatMember("managers", "helper01")).toEqual({ status: "SAVED" });
    expect(state.calls).toContain("DELETE /api/channels/3021/managers/601950");
    expect(state.managers).toEqual([]);
    // Already gone: nothing to remove.
    expect(await m.removeFlextvChatMember("managers", "helper01")).toEqual({ status: "SAVED" });
    expect(state.calls.filter((c) => c.startsWith("DELETE"))).toHaveLength(1);
  });
});

describe("유튜브 채팅 연결", () => {
  it("connects, hides its chat and disconnects", async () => {
    const m = await load();
    expect(await m.saveFlextvYoutubeLink("https://example.com/x")).toEqual({ status: "INVALID", message: "유효한 유튜브 채널 주소가 아닙니다." });
    expect(await m.showFlextvYoutubeChat(false)).toEqual({ status: "INVALID", message: "연결된 유튜브 채널이 없습니다." });
    expect(await m.saveFlextvYoutubeLink("https://www.youtube.com/@bj")).toEqual({ status: "SAVED" });
    expect(await m.showFlextvYoutubeChat(false)).toEqual({ status: "SAVED" });
    expect((await m.getFlextvChatSettings())!.youtube).toMatchObject({ kind: "handle", raw: "https://www.youtube.com/@bj", showInChat: false });
    expect(await m.removeFlextvYoutubeLink()).toEqual({ status: "SAVED" });
    expect((await m.getFlextvChatSettings())!.youtube).toBeNull();
  });
});
