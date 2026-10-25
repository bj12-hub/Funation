import type { LinkPlatform } from "@/lib/flextv/rules";

/** 채널 설정 with FLEXTV (phase 7) — client-safe types of ./flextvChannelSettings.ts. */

export type FlextvChannelSettingsView = {
  channelId: string;
  name: string;
  description: string;
  /** FLEXTV's default banner when none was uploaded. */
  bannerUrl: string | null;
  /** The streamer's FLEXTV profile picture, which is also the channel's (changed in 마이페이지). */
  avatarUrl: string | null;
  links: Record<LinkPlatform, string>;
};

export type ChannelSettingResult =
  | { status: "SAVED" }
  | { status: "INVALID"; message: string }
  | { status: "TAKEN" }
  | { status: "UNAUTHORIZED" };

export type ChannelNameCheck = { status: "AVAILABLE" } | { status: "TAKEN" } | { status: "UNAUTHORIZED" } | { status: "INVALID"; message: string };

export const LINK_LABEL: Record<LinkPlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  discord: "Discord",
  tiktok: "TikTok",
  twitter: "X (Twitter)"
};

/** A link is an http(s) address, as FLEXTV's 방송국 홈페이지 opens it. */
export const LINK_MAX = 500;
