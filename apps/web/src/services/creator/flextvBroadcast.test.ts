import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 5 on the FLEXTV backend: becoming a streamer and 방송 설정 (stream keys, start · change · end), against a
 * stubbed FLEXTV API.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)", host: "ssumnation.test" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true, forgot: 0 };
vi.mock("@/lib/session", () => {
  const session = () => ({ userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: member.creator ? ["SUPPORTER", "CREATOR"] : ["SUPPORTER"] });
  return {
    getSession: async () => session(),
    getCreatorSession: async () => (member.creator ? session() : null),
    getFlextvAccessToken: async () => "member-token",
    hasRole: (s: { roles: string[] } | null, role: string) => !!s && s.roles.includes(role),
    forgetFlextvSession: async () => {
      member.forgot += 1;
    }
  };
});

type Call = { path: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let state: { memberDiv: number; PI: unknown; isAdultCheck: number; open: boolean; live: boolean; startAnswer: [number, string]; suspended: boolean };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (body: string, status = 200) => new Response(body, { status });

const openStream = { id: 991, title: "저녁 방송", themeId: 5, password: "room-secret", isForAdult: 0, visitAllow: 1, useWatermark: 0, useRecordingwarning: 0, useAdultThumbnail: 0, displayMode: "landscape", tag: [{ code: "12", des: "토크" }] };

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvThemes;
  calls = [];
  member.creator = true;
  member.forgot = 0;
  state = { memberDiv: 2, PI: { isAdult: true }, isAdultCheck: 2, open: false, live: false, startAnswer: [200, "OK"], suspended: false };
  const routes: Record<string, (body: Record<string, unknown> | null) => Response> = {
    "/api/my/profile": () => json({ luv: 0, profile: { id: 601900, loginId: "bj01", nickname: "방송인", memberDiv: state.memberDiv, status: 1, PI: state.PI, isAdultCheck: state.isAdultCheck, isCustomForeigner: false } }),
    "/api/my/channel/profile": () =>
      json({
        id: 3021,
        name: "방송국",
        isInLive: state.live ? 1 : 0,
        stream: state.open ? openStream : undefined,
        laststreams: { ...openStream, id: 990, title: "어제 방송", password: "old-secret" },
        channelStop: state.suspended ? { status: 1, releaseDate: "2099-01-01T00:00:00Z", suspendedDesc: "운영정책 위반" } : null,
        keySet: { url: "rtmp://llh.flextv.test/live", streamKey: "llh-key", engine: "ncp_llh" }
      }),
    "/api/my/channel/stream-key-sets": () =>
      json([
        { url: "rtmp://llh.flextv.test/live", streamKey: "llh-key", engine: "ncp_llh" },
        { url: "rtmp://ncp.flextv.test/live", streamKey: "ncp-key", engine: "ncp" }
      ]),
    "/api/my/channel/streams/latest/engine": () => json({ engine: "ncp_llh" }),
    "/api/guest/themes": () => json([{ key: 1, value: "5", text: "토크/캠방" }, { key: 2, value: "7", text: "성인" }, { key: 3, value: "9", text: "게임" }]),
    "/api/my/channel/tag": () => json([{ code: "12", des: "토크" }, { code: "13", des: "게임" }, { code: "14", des: "음악" }, { code: "15", des: "먹방" }]),
    "/api/my/channel/start-stream": () => text(state.startAnswer[1], state.startAnswer[0]),
    "/api/my/channel/streams/991": () => text("OK"),
    "/api/my/channel/stop-stream": () => (state.open ? text("OK") : text("현재 방송중인 방송이 없습니다.", 400)),
    "/api/my/channel/update-stream-engine": () => json({ code: 0, data: true }),
    "/api/my/chennel-register": () => {
      state.memberDiv = 2;
      return text("waiting");
    }
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: u.pathname, method: init.method ?? "GET", body });
      const route = routes[u.pathname];
      if (!route) throw new Error(`unexpected FLEXTV call ${u.pathname}`);
      return route(body);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const input = (over: Record<string, unknown> = {}) => ({
  title: "오늘의 방송",
  themeId: "5",
  tagCodes: ["12"],
  forAdult: false,
  adultThumbnail: false,
  password: { mode: "NONE" },
  visitAllow: false,
  watermark: true,
  recordingWarning: false,
  displayMode: "landscape",
  resolution: "1080",
  agreed: true,
  ...over
});
const sent = (path: string) => calls.filter((c) => c.path === path);

describe("방송 설정", () => {
  it("shows the OBS 서버 and the form, never the room password or a stream key", async () => {
    state.open = true;
    state.live = true;
    const { getBroadcastView } = await import("./broadcast");
    const view = (await getBroadcastView())!;
    expect(view).toMatchObject({ channelId: "3021", watchPath: "/creators/3021", live: true, streaming: true, engine: "ncp_llh", adult: false });
    expect(view.keys).toEqual([
      { engine: "ncp_llh", label: "짧은 지연", serverUrl: "rtmp://llh.flextv.test/live" },
      { engine: "ncp", label: "일반", serverUrl: "rtmp://ncp.flextv.test/live" }
    ]);
    expect(view.defaults).toMatchObject({ title: "저녁 방송", themeId: "5", tagCodes: ["12"], hasPassword: true });
    // Under 19: no 성인 theme.
    expect(view.themes.map((t) => t.value)).toEqual(["5", "9"]);
    const shown = JSON.stringify(view);
    for (const secret of ["room-secret", "old-secret", "llh-key", "ncp-key"]) expect(shown).not.toContain(secret);
  });

  it("gives the stream key to its owner on request", async () => {
    const { revealStreamKey } = await import("./broadcast");
    expect(await revealStreamKey("ncp")).toEqual({ status: "OK", streamKey: "ncp-key" });
    expect(await revealStreamKey("aws")).toEqual({ status: "NOT_FOUND" });
    member.creator = false;
    expect(await revealStreamKey("ncp")).toEqual({ status: "UNAUTHORIZED" });
  });

  it("starts with FLEXTV's own fields after 방송 준수사항, on the engine FLEXTV uses", async () => {
    const { startBroadcast } = await import("./broadcast");
    expect(await startBroadcast(input({ agreed: false }))).toEqual({ status: "INVALID", message: "방송 준수사항에 동의해 주세요." });
    expect(sent("/api/my/channel/start-stream")).toHaveLength(0);

    expect(await startBroadcast(input({ password: { mode: "KEEP" } }))).toEqual({ status: "STARTED" });
    const [start] = sent("/api/my/channel/start-stream");
    expect(start.body).toMatchObject({ title: "오늘의 방송", theme: "5", tag: ["12"], isWatermark: true, engine: "ncp_llh", minRatingLevel: 0, password: "old-secret" });
    expect(start.body).not.toHaveProperty("force");
    expect(start.body).not.toHaveProperty("agreed");
  });

  it("explains a start before OBS sends, and refuses one on a 정지 channel or an open stream", async () => {
    const { startBroadcast } = await import("./broadcast");
    state.startAnswer = [400, "현재 채널로 영상이 송출되고 있지 않습니다."];
    expect(await startBroadcast(input())).toMatchObject({ status: "REFUSED", message: expect.stringContaining("OBS") });

    state.suspended = true;
    expect(await startBroadcast(input())).toMatchObject({ status: "REFUSED", message: expect.stringContaining("정지") });
    state.suspended = false;
    state.open = true;
    expect(await startBroadcast(input())).toMatchObject({ status: "INVALID" });
    expect(sent("/api/my/channel/start-stream")).toHaveLength(1);
  });

  it("changes the member's own open stream, keeping its password unless asked", async () => {
    state.open = true;
    const { updateBroadcast } = await import("./broadcast");
    expect(await updateBroadcast(input({ password: { mode: "KEEP" }, agreed: false, title: "바뀐 제목" }))).toEqual({ status: "UPDATED" });
    const [change] = sent("/api/my/channel/streams/991");
    expect(change.method).toBe("PUT");
    expect(change.body).toMatchObject({ title: "바뀐 제목", password: "room-secret" });
    expect(change.body).not.toHaveProperty("activeItem");

    await updateBroadcast(input({ password: { mode: "NONE" } }));
    expect(sent("/api/my/channel/streams/991")[1].body).toMatchObject({ password: "" });
    state.open = false;
    expect(await updateBroadcast(input())).toMatchObject({ status: "INVALID" });
  });

  it("ends the broadcast", async () => {
    const { stopBroadcast } = await import("./broadcast");
    state.open = true;
    expect(await stopBroadcast()).toEqual({ status: "STOPPED" });
    state.open = false;
    expect(await stopBroadcast()).toEqual({ status: "REFUSED", message: "지금 진행 중인 방송이 없어요." });
  });

  it("switches the engine of the member's own channel only, and not while a stream is open", async () => {
    const { changeStreamEngine } = await import("./broadcast");
    expect(await changeStreamEngine("ncp")).toEqual({ status: "SAVED", engine: "ncp" });
    expect(sent("/api/my/channel/update-stream-engine")[0].body).toEqual({ channelId: 3021, engineEngine: "ncp" });
    expect(await changeStreamEngine("aws")).toEqual({ status: "INVALID" });
    state.open = true;
    expect(await changeStreamEngine("ncp_llh")).toEqual({ status: "INVALID" });
    expect(sent("/api/my/channel/update-stream-engine")).toHaveLength(1);
  });
});

describe("the form as the server reads it", () => {
  const lists = { themes: [{ value: "5", label: "토크" }, { value: "7", label: "성인" }], tags: [{ value: "12", label: "토크" }, { value: "13", label: "게임" }, { value: "14", label: "음악" }, { value: "15", label: "먹방" }], adult: false };

  it("checks what FLEXTV's form allows", async () => {
    const { parseBroadcast } = await import("./broadcastInput");
    expect(parseBroadcast(input({ title: "  " }), lists)).toEqual({ invalid: "방송 제목을 입력해 주세요." });
    expect(parseBroadcast(input({ title: "가".repeat(65) }), lists)).toMatchObject({ invalid: expect.stringContaining("64") });
    expect(parseBroadcast(input({ themeId: "99" }), lists)).toEqual({ invalid: "카테고리를 골라 주세요." });
    expect(parseBroadcast(input({ tagCodes: ["12", "13", "14", "15"] }), lists)).toMatchObject({ invalid: expect.stringContaining("3개") });
    expect(parseBroadcast(input({ tagCodes: ["99"] }), lists)).toEqual({ invalid: "고를 수 없는 태그가 있어요." });
    expect(parseBroadcast(input({ forAdult: true }), lists)).toMatchObject({ invalid: expect.stringContaining("19세") });
    expect(parseBroadcast(input({ themeId: "7" }), { ...lists, adult: true })).toMatchObject({ invalid: expect.stringContaining("연령제한") });
    expect(parseBroadcast(input({ password: { mode: "SET", value: "with space" } }), lists)).toMatchObject({ invalid: expect.stringContaining("비밀번호") });
    expect(parseBroadcast(input({ resolution: "4k" }), lists)).toEqual({ invalid: "화질을 골라 주세요." });

    const ok = parseBroadcast(input({ title: "제목\u0007", adultThumbnail: true, password: { mode: "SET", value: "pa55!" } }), lists);
    expect(ok).toMatchObject({ form: { title: "제목", adultThumbnail: false }, password: { mode: "SET", value: "pa55!" }, agreed: true });
  });
});

describe("becoming a streamer", () => {
  beforeEach(() => {
    member.creator = false;
    state.memberDiv = 1;
    state.isAdultCheck = 3;
  });

  it("registers once after 방송 준수사항 and reads the member again", async () => {
    const { becomeStreamer } = await import("@/services/channel/flextvStreamer");
    expect(await becomeStreamer({ agreed: false })).toEqual({ status: "INVALID", message: "방송 준수사항에 동의해 주세요." });

    const [first, second] = await Promise.all([becomeStreamer({ agreed: true }), becomeStreamer({ agreed: true })]);
    expect(first).toEqual({ status: "REGISTERED" });
    expect(second).toEqual({ status: "REGISTERED" });
    // One at a time: the second saw the member as a streamer already.
    expect(sent("/api/my/chennel-register")).toHaveLength(1);
    expect(member.forgot).toBe(2);
  });

  it("stops at FLEXTV's gates before registering", async () => {
    const { becomeStreamer, getStreamerGate } = await import("@/services/channel/flextvStreamer");
    state.PI = null;
    expect(await getStreamerGate()).toBe("IDENTITY_REQUIRED");
    expect(await becomeStreamer({ agreed: true })).toEqual({ status: "IDENTITY_REQUIRED" });
    state.PI = { isAdult: false };
    state.isAdultCheck = 4;
    expect(await becomeStreamer({ agreed: true })).toEqual({ status: "UNDER_AGE" });
    expect(sent("/api/my/chennel-register")).toHaveLength(0);
  });
});
