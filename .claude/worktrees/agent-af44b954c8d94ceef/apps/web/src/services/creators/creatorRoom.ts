import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { Platform } from "@/types/platform";
import type { DonationCatalog } from "@/services/donations/donationCatalog";
import { getDonationCatalog } from "@/services/donations/signatureCore";
import { getCreatorById } from "./creators";

/**
 * Creator channel page (live watch when on air).
 * Figma: live 826:685 (채팅하기) · 610:138 (후원하기) · offline 710:195 · guest 712:47 / 710:2366
 * Route: `/creators/[id]`
 *
 * Stream data is read-only display data. The donation goal amounts are aggregated by the server.
 */

export type RoomBanner = {
  label: string;
  title: string;
  description: string;
  ctaLabel: string;
  imageUrl: string;
  /** Destination is TBD; the CTA renders as unavailable without it. */
  href?: string;
};

export type LiveStream = {
  status: "LIVE";
  caption: string;
  viewerCount: number;
  thumbnailUrl: string;
  /** e.g. "TOP 1 RANKER" — shown only when the server sends it. */
  rankBadge: string | null;
  qualityLabel: string;
  /** Today's donation goal in FN, aggregated by the server; `null` when the creator has none. */
  goal: { current: number; target: number } | null;
};

export type OfflineStream = { status: "OFFLINE"; imageUrl: string };

export type CreatorRoom = {
  creatorId: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  channels: { platform: Platform; logoUrl: string }[];
  banner: RoomBanner | null;
  stream: LiveStream | OfflineStream;
  donation: DonationCatalog;
};

export async function getCreatorRoom(creatorId: string): Promise<CreatorRoom | null> {
  if (!USE_MOCK) throw new Error("Creator room API is not connected yet.");
  const creator = await getCreatorById(creatorId);
  if (!creator) return null;
  await mockDelay(300);

  return {
    creatorId: creator.id,
    name: creator.name,
    tagline: creator.description,
    avatarUrl: creator.avatarUrl,
    channels: CHANNELS,
    banner: BANNER,
    stream:
      creator.isLive && creator.viewerCount !== null && !MOCK_OFFLINE.includes(creator.id)
        ? {
            status: "LIVE",
            caption: "금요일 밤 소통 방송 중! 오늘의 사연과 시청자 투표에 참여해 보세요.",
            viewerCount: creator.viewerCount,
            thumbnailUrl: "/mock/room/stream-chat.jpg",
            rankBadge: creator.id === "c4" ? "TOP 1 RANKER" : null,
            qualityLabel: "1080p60 • 초고화질",
            goal: { current: 740_000, target: 1_000_000 }
          }
        : { status: "OFFLINE", imageUrl: "/mock/room/offline.jpg" },
    donation: getDonationCatalog()
  };
}

// ── Mock data: Figma 826:685 / 610:138 ─────────────────────────────────────────
// 밤톨게임(c3) and 도도쭈(c2) are offline, as in the favorites frame 735:3856, so 710:195 can be seen.
const MOCK_OFFLINE = ["c2", "c3"];

const CHANNELS: CreatorRoom["channels"] = [
  { platform: "YOUTUBE", logoUrl: "/mock/room/logo-youtube.png" },
  { platform: "SOOP", logoUrl: "/mock/room/logo-soop.png" },
  { platform: "FLEXTV", logoUrl: "/mock/room/logo-flextv.png" }
];

const BANNER: RoomBanner = {
  label: "이벤트",
  title: "크루 방송 시즌 오픈 기념 이벤트",
  description: "엑셀방송에 참여한 시청자를 위한 시즌 이벤트예요. 보상 내용은 확정되면 안내돼요 (TBD).",
  ctaLabel: "이벤트 보기",
  imageUrl: "/mock/home/promo-banner.jpg",
  // Code-first: the events page (the specific promotion page is still TBD).
  href: "/events"
};
