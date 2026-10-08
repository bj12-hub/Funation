import type { Platform } from "@/types/platform";
import { PlatformError, type PlatformErrorCode } from "./platformTypes";

/**
 * Mock "remote" platforms for 통합 채팅 · 통합 후원 알림 — server-only, used by adapters.ts only.
 * Each platform keeps its own DTO shape (loosely modelled on what the platform delivers; the real
 * payloads are TBD until each API is confirmed) so the adapters do real mapping. The real backend will
 * hold long-lived chat connections (YouTube polling, CHZZK/SOOP/FlexTV sockets — TBD).
 */

export type YtChatDto = {
  id: string;
  snippet: { type: "textMessageEvent"; publishedAt: string; displayMessage: string };
  authorDetails: { channelId: string; displayName: string; isChatOwner: boolean; isChatModerator: boolean; isChatSponsor: boolean };
};
export type ChzzkChatDto = { messageId: string; senderChannelId: string; profile: { nickname: string; userRoleCode: "streamer" | "streaming_chat_manager" | "common_user"; subscription: boolean }; content: string; messageTime: number };
export type ChzzkDonationDto = { donationId: string; donatorChannelId: string; donatorNickname: string; payAmount: string; donationText: string; donatedAt: number };
export type SoopChatDto = { chatNo: number; userId: string; userNick: string; userFlag: "bj" | "manager" | "fan" | "normal"; message: string; ts: number };
export type SoopBalloonDto = { balloonNo: number; userId: string; userNick: string; count: number; message: string; ts: number };
export type FlexChatDto = { id: string; user: { id: string; nick: string; grade: "OWNER" | "MANAGER" | "VIP" | "NORMAL" }; text: string; createdAt: string };
export type FlexDonationDto = { id: string; user: { id: string; nick: string }; amount: number; text: string; createdAt: string };

type ChannelRemote = {
  yt: YtChatDto[];
  chzzk: ChzzkChatDto[];
  chzzkDonations: ChzzkDonationDto[];
  soop: SoopChatDto[];
  soopBalloons: SoopBalloonDto[];
  flex: FlexChatDto[];
  flexDonations: FlexDonationDto[];
  /** Moderation the platform applied (mock): deleted message ids, banned user ids. */
  deleted: Record<string, true>;
  bans: Record<string, { untilMs: number | null }>;
};

type Remote = { channels: Record<string, ChannelRemote>; seq: number; failNext: Partial<Record<Platform, PlatformErrorCode>> };

const g = globalThis as typeof globalThis & { __funationMockBroadcastRemoteV1?: Remote };
export const broadcastRemote = (): Remote => (g.__funationMockBroadcastRemoteV1 ??= { channels: {}, seq: 0, failNext: {} });

export const channelRemote = (channelId: string): ChannelRemote =>
  (broadcastRemote().channels[channelId] ??= { yt: [], chzzk: [], chzzkDonations: [], soop: [], soopBalloons: [], flex: [], flexDonations: [], deleted: {}, bans: {} });

export const nextRemoteSeq = () => ++broadcastRemote().seq;

/** Test hook: the next chat call to this platform fails with `code` (timeouts, outages, expired tokens). */
export function mockFailNextChatCall(platform: Platform, code: PlatformErrorCode) {
  broadcastRemote().failNext[platform] = code;
}

export function consumeFailure(platform: Platform) {
  const code = broadcastRemote().failNext[platform];
  if (!code) return;
  delete broadcastRemote().failNext[platform];
  throw new PlatformError(code, code.toLowerCase());
}

export type MockViewerMessage = { userId: string; nick: string; text: string; role?: "OWNER" | "MODERATOR" | "MEMBER" | null };

/** Mock only: a viewer chats on the platform (the 통합 채팅 developer simulator and tests call this). */
export function mockViewerChat(platform: Platform, channelId: string, m: MockViewerMessage) {
  const r = channelRemote(channelId);
  const n = nextRemoteSeq();
  const now = Date.now();
  switch (platform) {
    case "YOUTUBE":
      r.yt.push({
        id: `ytm-${n}`,
        snippet: { type: "textMessageEvent", publishedAt: new Date(now).toISOString(), displayMessage: m.text },
        authorDetails: { channelId: m.userId, displayName: m.nick, isChatOwner: m.role === "OWNER", isChatModerator: m.role === "MODERATOR", isChatSponsor: m.role === "MEMBER" }
      });
      return `ytm-${n}`;
    case "CHZZK":
      r.chzzk.push({
        messageId: `chz-${n}`,
        senderChannelId: m.userId,
        profile: { nickname: m.nick, userRoleCode: m.role === "OWNER" ? "streamer" : m.role === "MODERATOR" ? "streaming_chat_manager" : "common_user", subscription: m.role === "MEMBER" },
        content: m.text,
        messageTime: now
      });
      return `chz-${n}`;
    case "SOOP":
      r.soop.push({ chatNo: n, userId: m.userId, userNick: m.nick, userFlag: m.role === "OWNER" ? "bj" : m.role === "MODERATOR" ? "manager" : m.role === "MEMBER" ? "fan" : "normal", message: m.text, ts: now });
      return String(n);
    case "FLEXTV":
      r.flex.push({ id: `flx-${n}`, user: { id: m.userId, nick: m.nick, grade: m.role === "OWNER" ? "OWNER" : m.role === "MODERATOR" ? "MANAGER" : m.role === "MEMBER" ? "VIP" : "NORMAL" }, text: m.text, createdAt: new Date(now).toISOString() });
      return `flx-${n}`;
  }
}

/** Mock only: a platform-native donation (CHZZK 치즈 · SOOP 별풍선 · FlexTV 후원). YouTube uses mockYouTubeSuperChat. */
export function mockPlatformDonation(platform: Exclude<Platform, "YOUTUBE">, channelId: string, input: { id?: string; userId: string; nick: string; amount: number; message: string }) {
  const r = channelRemote(channelId);
  const n = nextRemoteSeq();
  const now = Date.now();
  if (platform === "CHZZK") r.chzzkDonations.push({ donationId: input.id ?? `chzd-${n}`, donatorChannelId: input.userId, donatorNickname: input.nick, payAmount: String(input.amount), donationText: input.message, donatedAt: now });
  if (platform === "SOOP") r.soopBalloons.push({ balloonNo: input.id ? Number(input.id.replace(/\D/g, "")) || n : n, userId: input.userId, userNick: input.nick, count: input.amount, message: input.message, ts: now });
  if (platform === "FLEXTV") r.flexDonations.push({ id: input.id ?? `flxd-${n}`, user: { id: input.userId, nick: input.nick }, amount: input.amount, text: input.message, createdAt: new Date(now).toISOString() });
}
