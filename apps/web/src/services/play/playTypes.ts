import type { Platform } from "@/types/platform";

/** 시청자 참여 게임 (마블 룰렛 · 로얄 럼블) — what both games share: entry limits and where an entrant came from. */

export const PLAY_KEYWORD_MAX = 10;
export const PLAY_NAME_MAX = 20;

/** Where an entrant came from: a chat platform, the 초대 링크, or the operator. */
export type PlaySource = Platform | "INVITE" | "MANUAL";
