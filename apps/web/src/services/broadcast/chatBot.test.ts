import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_CHATBOT, canUse, listReply, matchCommand, renderReply, type ChatBotSettings, type ChatCommand } from "./chatBotTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 채팅봇 명령어 (2026-10-24, StreamDonate (DallaHelper) 참고) — P3. */
async function load() {
  const chat = await import("./unifiedChat");
  const yt = await import("@/services/creator/youtube");
  const bot = await import("./chatBot");
  return { ...chat, ...yt, ...bot };
}
type M = Awaited<ReturnType<typeof load>>;

async function connectAll(m: M) {
  await m.connectYouTube({ handle: "streamer", requestId: key(900) });
  for (const platform of ["CHZZK", "SOOP", "FLEXTV"]) expect(await m.connectBroadcastChannel({ platform, handle: "streamer" })).toEqual({ status: "OK" });
}

let n = 0;
/** A viewer's chat line on `platform` (read into the feed at once, which runs the bot). */
const say = async (m: M, platform: string, text: string, extra: Record<string, unknown> = {}) =>
  expect(await m.simulateViewerChat({ requestId: key(1000 + ++n), platform, nick: `시청자${n}`, text, ...extra })).toEqual({ status: "OK" });

const command = (patch: Partial<ChatCommand> = {}): ChatCommand => ({ id: "cmd-notice", trigger: "!공지", response: "{nickname}님, 오늘 8시 방송이에요 ({platform})", access: "ALL", cooldownSec: 30, enabled: true, ...patch });
const settings = (patch: Partial<ChatBotSettings> = {}): ChatBotSettings => ({ ...DEFAULT_CHATBOT, enabled: true, commands: [command()], ...patch });
/** The bot's replies in the feed, as "PLATFORM:text". */
const replies = async (m: M) =>
  (await m.getUnifiedChat())!.messages.filter((x) => x.author.roles.includes("OWNER")).map((x) => `${x.platform}:${x.text}`);

const T0 = new Date("2026-10-24T12:00:00Z");

describe("채팅봇 명령어 규칙", () => {
  it("matches a command by its first word, ignoring case, and the 목록 명령어", () => {
    const s = settings({ commands: [command(), command({ id: "cmd-off", trigger: "!Discord", enabled: false }), command({ id: "cmd-yt", trigger: "!YT" })] });
    expect(matchCommand(s, "  !공지 언제예요?")).toEqual({ kind: "COMMAND", command: s.commands[0] });
    expect(matchCommand(s, "!yt")).toEqual({ kind: "COMMAND", command: s.commands[2] });
    expect(matchCommand(s, "!discord")).toBeNull(); // turned off
    expect(matchCommand(s, "공지 !공지")).toBeNull();
    expect(matchCommand(s, "!명령어")).toEqual({ kind: "LIST" });
    expect(matchCommand({ ...s, listCommand: false }, "!명령어")).toBeNull();
    expect(listReply(s)).toBe("명령어: !공지 · !YT");
    expect(listReply({ ...s, commands: [] })).toBe("등록된 명령어가 없어요.");
  });

  it("lets 매니저 이상 · 방송인만 commands follow the platform's roles, and fills the variables", () => {
    expect([canUse("ALL", []), canUse("MANAGER", []), canUse("MANAGER", ["MODERATOR"]), canUse("MANAGER", ["OWNER"]), canUse("OWNER", ["MODERATOR"]), canUse("OWNER", ["OWNER"])]).toEqual([
      true,
      false,
      true,
      true,
      false,
      true
    ]);
    expect(renderReply("{nickname}님 ({platform})", { nickname: "철수", platform: "CHZZK" })).toBe("철수님 (치지직)");
    // A nickname is never read as a variable.
    expect(renderReply("{nickname} · {platform}", { nickname: "{platform}", platform: "YOUTUBE" })).toBe("{platform} · YouTube");
    expect(renderReply("가".repeat(150) + "{nickname}", { nickname: "나".repeat(100), platform: "YOUTUBE" })).toHaveLength(200);
  });
});

describe("채팅봇 명령어", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect((await m.getChatBotView())!.settings).toEqual(DEFAULT_CHATBOT);
    expect(await m.saveChatBot(settings({ platforms: ["CHZZK", "YOUTUBE"], commands: [command({ trigger: " !공지 ", response: " 안내 " })] }))).toEqual({ status: "SAVED" });
    expect((await m.getChatBotView())!.settings).toEqual({ ...settings(), platforms: ["YOUTUBE", "CHZZK"], commands: [command({ response: "안내" })] });
    for (const [patch, message] of [
      [{ trigger: "공지" }, "명령어는 !로 시작하고 띄어쓰기 없이 2~20자로 입력해 주세요."],
      [{ trigger: "!" }, "명령어는 !로 시작하고 띄어쓰기 없이 2~20자로 입력해 주세요."],
      [{ trigger: "!공 지" }, "명령어는 !로 시작하고 띄어쓰기 없이 2~20자로 입력해 주세요."],
      [{ trigger: `!${"가".repeat(20)}` }, "명령어는 !로 시작하고 띄어쓰기 없이 2~20자로 입력해 주세요."],
      [{ trigger: "!명령어" }, "!명령어는 명령어 목록으로 쓰고 있어요. 다른 명령어를 입력해 주세요."],
      [{ response: " " }, "!공지의 응답은 1~200자로 입력해 주세요."],
      [{ response: "가".repeat(201) }, "!공지의 응답은 1~200자로 입력해 주세요."],
      [{ response: "admin 문의" }, "사용할 수 없는 단어가 포함되어 있어요."],
      [{ cooldownSec: 3601 }, "쿨다운은 0 ~ 3600초예요."],
      [{ access: "VIP" }, "설정을 확인해 주세요."]
    ] as const) {
      expect(await m.saveChatBot(settings({ commands: [command(patch as Partial<ChatCommand>)] }))).toEqual({ status: "INVALID", message });
    }
    expect(await m.saveChatBot(settings({ commands: [command(), command({ id: "cmd-2", trigger: "!공지" })] }))).toEqual({ status: "INVALID", message: "!공지 명령어가 두 번 있어요." });
    expect(await m.saveChatBot(settings({ commands: Array.from({ length: 31 }, (_, i) => command({ id: `cmd-${i}`, trigger: `!c${i}` })) }))).toEqual({
      status: "INVALID",
      message: "명령어는 30개까지 만들 수 있어요."
    });
    expect(await m.saveChatBot(settings({ platforms: ["TWITCH"] as never }))).toEqual({ status: "INVALID", message: "설정을 확인해 주세요." });
    signIn(["SUPPORTER"]);
    expect(await m.saveChatBot(settings())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getChatBotView()).toBeNull();
  });

  it("answers a command in the chat it came from, once, within its 쿨다운 and the viewer's role", async () => {
    const m = await load();
    await connectAll(m);
    await say(m, "YOUTUBE", "!공지"); // before the bot is on
    expect(await m.saveChatBot(settings({ commands: [command(), command({ id: "cmd-mod", trigger: "!관리", response: "관리 안내", access: "MANAGER", cooldownSec: 0 })] }))).toEqual({ status: "SAVED" });
    await m.getChatBotView();
    expect(await replies(m)).toEqual([]); // nothing from before it was turned on

    await say(m, "YOUTUBE", "!공지 언제?");
    expect(await replies(m)).toEqual([`YOUTUBE:시청자${n}님, 오늘 8시 방송이에요 (YouTube)`]);
    await say(m, "YOUTUBE", "!공지"); // within 30 s on YouTube
    await say(m, "CHZZK", "!공지"); // 치지직 has its own 쿨다운
    vi.setSystemTime(T0.getTime() + 31_000);
    await say(m, "YOUTUBE", "!공지");
    await say(m, "CHZZK", "!관리");
    await say(m, "CHZZK", "!관리", { role: "MODERATOR" });
    await say(m, "SOOP", "!명령어"); // SOOP cannot send chat: logged, the 쿨다운 stays free
    await say(m, "CHZZK", "!명령어");
    await say(m, "CHZZK", "그냥 대화");
    expect(await replies(m)).toEqual([
      "YOUTUBE:시청자2님, 오늘 8시 방송이에요 (YouTube)",
      "CHZZK:시청자4님, 오늘 8시 방송이에요 (치지직)",
      "YOUTUBE:시청자5님, 오늘 8시 방송이에요 (YouTube)",
      "CHZZK:관리 안내",
      "CHZZK:명령어: !공지"
    ]);
    const log = (await m.getChatBotView())!.log.map((e) => `${e.platform} ${e.trigger} ${e.outcome}`);
    expect(log.reverse()).toEqual([
      "YOUTUBE !공지 SENT",
      "YOUTUBE !공지 COOLDOWN",
      "CHZZK !공지 SENT",
      "YOUTUBE !공지 SENT",
      "CHZZK !관리 NO_ACCESS",
      "CHZZK !관리 SENT",
      "SOOP !명령어 UNSUPPORTED",
      "CHZZK !명령어 SENT"
    ]);
  });

  it("never answers itself, skips platforms it is not on, and caps replies per minute", async () => {
    const m = await load();
    await connectAll(m);
    // A reply that starts with its own command, no 쿨다운: the echo must not set it off again.
    await m.saveChatBot(settings({ platforms: ["YOUTUBE"], commands: [command({ id: "cmd-ping", trigger: "!핑", response: "!핑 퐁", cooldownSec: 0 })] }));
    await m.getChatBotView();
    await say(m, "YOUTUBE", "!핑");
    await say(m, "YOUTUBE", "안녕");
    await m.getChatBotView();
    expect(await replies(m)).toEqual(["YOUTUBE:!핑 퐁"]);
    await say(m, "CHZZK", "!핑"); // not answering on 치지직
    expect(await replies(m)).toEqual(["YOUTUBE:!핑 퐁"]);

    for (let i = 0; i < 21; i++) await say(m, "YOUTUBE", "!핑");
    expect(await replies(m)).toHaveLength(20);
    expect((await m.getChatBotView())!.log[0].outcome).toBe("RATE_LIMIT");
    vi.setSystemTime(T0.getTime() + 61_000);
    await say(m, "YOUTUBE", "!핑");
    expect(await replies(m)).toHaveLength(21);
  });
});
