import type { RoomDonor } from "@/services/live/roomLiveTypes";

/** 방송 설정's 지금 방송 panel with FLEXTV (phase 10, docs/development/flextv-backend.md "10단계"). */

export type LiveViewerRole = "OWNER" | "MANAGER" | "HOT_FAN" | "FAN" | "VIEWER";

/** One member in the room, named by 아이디 (FLEXTV's member numbers stay on the server). */
export type LiveViewer = { loginId: string; nickname: string; role: LiveViewerRole; fanLevel: number; muted: boolean };

export type LiveControlView = {
  channelId: string;
  /** FLEXTV's embeddable player of the channel, for 미리보기. */
  playerUrl: string;
  startedAt: string | null;
  viewers: number | null;
  totalViewers: number | null;
  /** 채팅 얼리기; null when FLEXTV did not say. */
  frozen: boolean | null;
  donors: RoomDonor[];
  /** The first 50 in the room; null when FLEXTV did not say. */
  people: LiveViewer[] | null;
};

export type LiveControlAction = "MUTE" | "UNMUTE" | "KICK" | "BLACKLIST" | "FREEZE";

export type LiveControlResult = { status: "DONE" } | { status: "UNAUTHORIZED" } | { status: "INVALID"; message: string };

export const LIVE_ROLE_LABEL: Record<LiveViewerRole, string> = { OWNER: "방송인", MANAGER: "매니저", HOT_FAN: "열혈팬", FAN: "팬", VIEWER: "시청자" };
