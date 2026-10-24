import type { ChatAuthorRole } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { CHAT_TEXT_MAX } from "./chatTypes";

/**
 * 채팅봇 명령어 — code-first, StreamDonate (DallaHelper) "채팅봇 명령어" 참고 (P3). Client-safe. A viewer types a command
 * (`!공지`) in any connected platform's chat; the bot answers in that platform's chat as the channel, with the reply the
 * creator set. 쿨다운 per command and a per-minute cap keep it from flooding; who may use a command follows the
 * platform's own roles (방송인 · 매니저). Platforms without chat sending (the adapter's CHAT_SEND) are not answered.
 */

export const BOT_COMMANDS_MAX = 30;
export const BOT_TRIGGER_MAX = 20;
export const BOT_RESPONSE_MAX = CHAT_TEXT_MAX;
export const BOT_COOLDOWN_MAX = 3600;
export const BOT_COOLDOWN_DEFAULT = 30;
/** Replies across all commands per minute (기본값). */
export const BOT_REPLIES_PER_MIN = 20;
export const BOT_LOG_MAX = 50;
/** The built-in 목록 명령어: lists the commands everyone may use. */
export const BOT_LIST_TRIGGER = "!명령어";

export type BotAccess = "ALL" | "MANAGER" | "OWNER";
export const BOT_ACCESS: { key: BotAccess; label: string }[] = [
  { key: "ALL", label: "모두" },
  { key: "MANAGER", label: "매니저 이상" },
  { key: "OWNER", label: "방송인만" }
];

export type ChatCommand = { id: string; trigger: string; response: string; access: BotAccess; cooldownSec: number; enabled: boolean };
export type ChatBotSettings = { enabled: boolean; platforms: Platform[]; listCommand: boolean; commands: ChatCommand[] };
export const DEFAULT_CHATBOT: ChatBotSettings = { enabled: false, platforms: ["YOUTUBE", "CHZZK", "SOOP", "FLEXTV"], listCommand: true, commands: [] };

/** What happened to a command a viewer typed. */
export type BotOutcome = "SENT" | "COOLDOWN" | "NO_ACCESS" | "RATE_LIMIT" | "NOT_CONNECTED" | "UNSUPPORTED" | "PENDING" | "UNCONFIRMED" | "FAILED";
export const BOT_OUTCOME_LABEL: Record<BotOutcome, string> = {
  SENT: "답함",
  COOLDOWN: "쿨다운",
  NO_ACCESS: "권한 없음",
  RATE_LIMIT: "1분 한도",
  NOT_CONNECTED: "연결 안 됨",
  UNSUPPORTED: "보내기 미지원",
  PENDING: "보내는 중",
  UNCONFIRMED: "확인 안 됨",
  FAILED: "실패"
};
export type BotLogEntry = { at: string; platform: Platform; nickname: string; trigger: string; outcome: BotOutcome; reply: string | null };

/** Whether the bot can answer on a platform now: connected, and the platform lets us send chat. */
export type BotPlatformState = "OK" | "NOT_CONNECTED" | "UNSUPPORTED";
/** The studio: settings, the latest answers, and where the bot can answer now. */
export type ChatBotView = { settings: ChatBotSettings; log: BotLogEntry[]; platforms: Record<Platform, BotPlatformState> };
export type ChatBotResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export const BOT_VARIABLES = [
  { key: "{nickname}", label: "명령어를 쓴 시청자 닉네임" },
  { key: "{platform}", label: "플랫폼 이름 (YouTube · 치지직 …)" }
] as const;

const lower = (s: string) => s.toLocaleLowerCase("ko-KR");

/** The command a chat line calls — its first word, ignoring case — among the enabled ones, or the 목록 명령어. */
export function matchCommand(settings: ChatBotSettings, text: string): { kind: "LIST" } | { kind: "COMMAND"; command: ChatCommand } | null {
  const first = lower(text.trim().split(/\s+/, 1)[0] ?? "");
  if (!first) return null;
  if (settings.listCommand && first === lower(BOT_LIST_TRIGGER)) return { kind: "LIST" };
  const command = settings.commands.find((c) => c.enabled && lower(c.trigger) === first);
  return command ? { kind: "COMMAND", command } : null;
}

/** Whether someone with `roles` may use a command open to `access`. */
export const canUse = (access: BotAccess, roles: readonly ChatAuthorRole[]) =>
  access === "ALL" || roles.includes("OWNER") || (access === "MANAGER" && roles.includes("MODERATOR"));

/** The reply with its variables filled (the nickname last, so a nickname is never read as a variable), cut to a chat message. */
export const renderReply = (template: string, ctx: { nickname: string; platform: Platform }) =>
  template.split("{platform}").join(PLATFORM_LABEL[ctx.platform]).split("{nickname}").join(ctx.nickname).slice(0, BOT_RESPONSE_MAX);

/** The 목록 명령어's answer: the enabled commands everyone may use. */
export function listReply(settings: ChatBotSettings) {
  const open = settings.commands.filter((c) => c.enabled && c.access === "ALL").map((c) => c.trigger);
  return (open.length ? `명령어: ${open.join(" · ")}` : "등록된 명령어가 없어요.").slice(0, BOT_RESPONSE_MAX);
}
