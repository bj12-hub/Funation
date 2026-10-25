import type { YoutubeChatLink } from "@/lib/flextv/chatSettings";

/** 채팅 관리 with FLEXTV (phase 9) — client-safe types of ./flextvChatSettings.ts. */

export { BAN_WORD_MAX, CHAT_NOTICE_MAX } from "@/lib/flextv/rules";
export type { YoutubeChatLink } from "@/lib/flextv/chatSettings";

/** Someone on the channel's 매니저 or 블랙리스트, known here by their FLEXTV 아이디. */
export type ChatMember = { loginId: string; nickname: string; since: string };

export type FlextvChatSettingsView = {
  notice: string;
  rule: string;
  banWords: { id: string; word: string }[];
  managers: ChatMember[];
  blacklist: ChatMember[];
  youtube: YoutubeChatLink | null;
};

export type ChatSettingResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
