"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { ADAPTERS, BROADCAST_PLATFORMS } from "@/services/platforms/adapters";
import type { Platform } from "@/types/platform";
import { broadcastChannelId } from "./channelsCore";
import { botStore, parseChatBotSettings, saveChatBotSettings } from "./chatBotCore";
import type { BotPlatformState, ChatBotResult, ChatBotView } from "./chatBotTypes";
import { ingestChat } from "./chatCore";

/**
 * 채팅봇 명령어 Server Actions — code-first (no Figma frame; StreamDonate (DallaHelper) 참고, P3). Studio route
 * `/creator/chat/bot` (creator session). The bot itself runs with every 통합 채팅 read (studio, OBS chat overlay …).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Chat bot API is not connected yet.");
};

export async function getChatBotView(): Promise<ChatBotView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  // Reading the feed also lets the bot answer what came in meanwhile.
  await ingestChat();
  const b = botStore();
  return {
    settings: structuredClone(b.settings),
    log: structuredClone(b.log),
    platforms: Object.fromEntries(
      BROADCAST_PLATFORMS.map((p): [Platform, BotPlatformState] => [p, !ADAPTERS[p].capabilities.includes("CHAT_SEND") ? "UNSUPPORTED" : broadcastChannelId(p) ? "OK" : "NOT_CONNECTED"])
    ) as Record<Platform, BotPlatformState>
  };
}

/** Replaces the bot settings (a retried save writes the same values). */
export async function saveChatBot(input: unknown): Promise<ChatBotResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseChatBotSettings(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  saveChatBotSettings(parsed);
  return { status: "SAVED" };
}
