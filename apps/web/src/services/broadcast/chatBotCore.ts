import { ADAPTERS, BROADCAST_PLATFORMS } from "@/services/platforms/adapters";
import type { Platform } from "@/types/platform";
import {
  BOT_ACCESS,
  BOT_COMMANDS_MAX,
  BOT_COOLDOWN_DEFAULT,
  BOT_COOLDOWN_MAX,
  BOT_LIST_TRIGGER,
  BOT_LOG_MAX,
  BOT_REPLIES_PER_MIN,
  BOT_RESPONSE_MAX,
  BOT_TRIGGER_MAX,
  DEFAULT_CHATBOT,
  canUse,
  listReply,
  matchCommand,
  renderReply,
  type BotLogEntry,
  type BotOutcome,
  type ChatBotSettings,
  type ChatCommand
} from "./chatBotTypes";
import { broadcastChannelId } from "./channelsCore";
import { chatStore, sendChat } from "./chatCore";

/**
 * 채팅봇 명령어 (server-only) — code-first. Runs after each 통합 채팅 read (`ingestChat`) over the messages that arrived
 * since the last run: the cursor moves before any reply is sent, so a message is answered once even when reads overlap,
 * and each reply is sent with the requestId `bot:<message id>` (a retried send never posts twice). The bot never answers
 * itself — the echoes of its replies are remembered, and studio sends and hidden lines are skipped — and a run started
 * while another is sending waits for the next read. 쿨다운 counts per platform (each chat is its own audience); a
 * platform the bot cannot answer on (not connected, no chat sending) is logged without using up the 쿨다운 or the cap.
 */

type BotStore = {
  settings: ChatBotSettings;
  /** The last feed `seq` looked at; null until the first run (it starts from "now"). */
  lastSeq: number | null;
  /** When each command (or the 목록 명령어) last answered on each platform (`platform:command`), ms. */
  lastFired: Record<string, number>;
  /** Reply times in the last minute, ms. */
  recent: number[];
  /** Feed ids of the bot's own replies as the platforms echo them back. */
  echoes: string[];
  log: BotLogEntry[];
  running: boolean;
};
const LIST_KEY = "__list";
const ECHOES_MAX = 200;

const g = globalThis as typeof globalThis & { __ssumnationMockChatBotV1?: BotStore };
export const botStore = (): BotStore =>
  (g.__ssumnationMockChatBotV1 ??= { settings: structuredClone(DEFAULT_CHATBOT), lastSeq: null, lastFired: {}, recent: [], echoes: [], log: [], running: false });

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const lower = (s: string) => s.toLocaleLowerCase("ko-KR");

export function parseChatBotSettings(input: unknown, forbidden: string[]): ChatBotSettings | { message: string } {
  const v = rec(input);
  if (typeof v.enabled !== "boolean" || typeof v.listCommand !== "boolean" || !Array.isArray(v.platforms) || !Array.isArray(v.commands)) return { message: "설정을 확인해 주세요." };
  if (!v.platforms.every((p) => BROADCAST_PLATFORMS.includes(p as Platform))) return { message: "설정을 확인해 주세요." };
  const platforms = BROADCAST_PLATFORMS.filter((p) => (v.platforms as unknown[]).includes(p));
  if (v.commands.length > BOT_COMMANDS_MAX) return { message: `명령어는 ${BOT_COMMANDS_MAX}개까지 만들 수 있어요.` };
  const banned = (text: string) => forbidden.some((w) => text.toLowerCase().includes(w));
  const commands: ChatCommand[] = [];
  for (const raw of v.commands) {
    const c = rec(raw);
    if (typeof c.id !== "string" || !/^[A-Za-z0-9-]{4,40}$/.test(c.id) || commands.some((x) => x.id === c.id)) return { message: "설정을 확인해 주세요." };
    const trigger = typeof c.trigger === "string" ? c.trigger.trim() : "";
    if (!/^![^\s!]/.test(trigger) || trigger.length > BOT_TRIGGER_MAX || /\s/.test(trigger)) return { message: `명령어는 !로 시작하고 띄어쓰기 없이 2~${BOT_TRIGGER_MAX}자로 입력해 주세요.` };
    if (lower(trigger) === lower(BOT_LIST_TRIGGER)) return { message: `${BOT_LIST_TRIGGER}는 명령어 목록으로 쓰고 있어요. 다른 명령어를 입력해 주세요.` };
    if (commands.some((x) => lower(x.trigger) === lower(trigger))) return { message: `${trigger} 명령어가 두 번 있어요.` };
    const response = typeof c.response === "string" ? c.response.trim() : "";
    if (!response || response.length > BOT_RESPONSE_MAX) return { message: `${trigger}의 응답은 1~${BOT_RESPONSE_MAX}자로 입력해 주세요.` };
    if (banned(trigger) || banned(response)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    const access = BOT_ACCESS.find((a) => a.key === c.access)?.key;
    if (!access || typeof c.enabled !== "boolean") return { message: "설정을 확인해 주세요." };
    if (!isInt(c.cooldownSec, 0, BOT_COOLDOWN_MAX)) return { message: `쿨다운은 0 ~ ${BOT_COOLDOWN_MAX}초예요.` };
    commands.push({ id: c.id, trigger, response, access, cooldownSec: c.cooldownSec, enabled: c.enabled });
  }
  return { enabled: v.enabled, platforms, listCommand: v.listCommand, commands };
}

/** Replaces the settings. Turning the bot on starts it from "now": nothing said before is answered. */
export function saveChatBotSettings(next: ChatBotSettings) {
  const b = botStore();
  if (next.enabled && !b.settings.enabled) b.lastSeq = chatStore().seq;
  b.settings = next;
}

const addLog = (b: BotStore, entry: BotLogEntry) => {
  b.log.unshift(entry);
  b.log.splice(BOT_LOG_MAX);
};

/** Answers the commands among the messages since the last run. Never throws into the chat read (errors are logged). */
export async function runChatBot(now = Date.now()) {
  const b = botStore();
  const s = chatStore();
  if (b.running) return;
  if (b.lastSeq === null || !b.settings.enabled) {
    b.lastSeq = s.seq;
    return;
  }
  const since = b.lastSeq;
  b.lastSeq = s.seq;
  const jobs: { messageId: string; platform: Platform; reply: string; entry: Omit<BotLogEntry, "outcome" | "reply"> }[] = [];
  for (const m of s.messages) {
    if (m.seq <= since || m.fromStudio || m.hidden || b.echoes.includes(m.id)) continue;
    const hit = matchCommand(b.settings, m.text);
    if (!hit || !b.settings.platforms.includes(m.platform)) continue;
    const entry = { at: new Date(now).toISOString(), platform: m.platform, nickname: m.author.displayName, trigger: hit.kind === "LIST" ? BOT_LIST_TRIGGER : hit.command.trigger };
    const skip = (outcome: BotOutcome) => addLog(b, { ...entry, outcome, reply: null });
    if (hit.kind === "COMMAND" && !canUse(hit.command.access, m.author.roles)) {
      skip("NO_ACCESS");
      continue;
    }
    if (!broadcastChannelId(m.platform)) {
      skip("NOT_CONNECTED");
      continue;
    }
    if (!ADAPTERS[m.platform].capabilities.includes("CHAT_SEND")) {
      skip("UNSUPPORTED");
      continue;
    }
    const key = `${m.platform}:${hit.kind === "LIST" ? LIST_KEY : hit.command.id}`;
    const cooldown = hit.kind === "LIST" ? BOT_COOLDOWN_DEFAULT : hit.command.cooldownSec;
    if (b.lastFired[key] !== undefined && now - b.lastFired[key] < cooldown * 1000) {
      skip("COOLDOWN");
      continue;
    }
    b.recent = b.recent.filter((t) => now - t < 60_000);
    if (b.recent.length >= BOT_REPLIES_PER_MIN) {
      skip("RATE_LIMIT");
      continue;
    }
    b.lastFired[key] = now;
    b.recent.push(now);
    const reply = hit.kind === "LIST" ? listReply(b.settings) : renderReply(hit.command.response, { nickname: m.author.displayName, platform: m.platform });
    jobs.push({ messageId: m.id, platform: m.platform, reply, entry });
  }
  if (jobs.length === 0) return;
  b.running = true;
  try {
    for (const j of jobs) {
      let outcome: BotOutcome = "FAILED";
      try {
        const r = (await sendChat(`bot:${j.messageId}`, j.reply, [j.platform]))[j.platform];
        if (r) outcome = r.status;
        if (r?.status === "SENT") {
          b.echoes.push(`${j.platform}:${r.externalMessageId}`);
          b.echoes.splice(0, Math.max(0, b.echoes.length - ECHOES_MAX));
        }
      } catch {
        // Logged as 실패; the chat read goes on.
      }
      addLog(b, { ...j.entry, outcome, reply: j.reply });
    }
  } finally {
    b.running = false;
  }
}
