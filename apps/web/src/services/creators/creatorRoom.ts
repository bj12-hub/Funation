import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { Platform } from "@/types/platform";
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

export type DonationType = { key: "TEXT" | "MINI" | "VIDEO" | "SIGNATURE" | "WISHLIST" | "LUCKYBOX"; emoji: string; label: string; title: string };

export type Voice = { id: string; emoji: string; name: string; description: string };

export type CreatorRoom = {
  creatorId: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  channels: { platform: Platform; logoUrl: string }[];
  banner: RoomBanner | null;
  stream: LiveStream | OfflineStream;
  donation: {
    types: DonationType[];
    /** Minimum amount per donation in FN (Figma 610:138 "최소 1,000 FN부터"). Server-owned; TBD. */
    minAmount: number;
    voices: Voice[];
  };
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
            caption: "이노레이블 x 탑스트리머 4차 특별오디션 생중계 중! 후원 및 실시간 투표에 참여해보세요.",
            viewerCount: creator.viewerCount,
            thumbnailUrl: "/mock/room/stream-chat.jpg",
            rankBadge: creator.id === "c4" ? "TOP 1 RANKER" : null,
            qualityLabel: "1080p60 • 초고화질",
            goal: { current: 740_000, target: 1_000_000 }
          }
        : { status: "OFFLINE", imageUrl: "/mock/room/offline.jpg" },
    donation: DONATION
  };
}

// ── Mock data: Figma 826:685 / 610:138 ─────────────────────────────────────────
// 빠니보틀(c3) and 곽튜브(c2) are offline, as in the favorites frame 735:3856, so 710:195 can be seen.
const MOCK_OFFLINE = ["c2", "c3"];

const CHANNELS: CreatorRoom["channels"] = [
  { platform: "YOUTUBE", logoUrl: "/mock/room/logo-youtube.png" },
  { platform: "SOOP", logoUrl: "/mock/room/logo-soop.png" },
  { platform: "FLEXTV", logoUrl: "/mock/room/logo-flextv.png" }
];

const BANNER: RoomBanner = {
  label: "이벤트",
  title: "Funation 첫 결제 프로모션! 프리미엄 1개월 무료 체험",
  description: "지금 구독하면 광고 없는 초고화질 무제한 스트리밍이 첫 달 무료! 최신 오리지널 예능 단독 오픈.",
  ctaLabel: "지금 참여하기",
  imageUrl: "/mock/home/promo-banner.jpg"
};

const DONATION: CreatorRoom["donation"] = {
  types: [
    { key: "TEXT", emoji: "💬", label: "일반", title: "일반 후원" },
    { key: "MINI", emoji: "⚡", label: "미니", title: "미니 후원" },
    { key: "VIDEO", emoji: "🎬", label: "영상", title: "영상 후원" },
    { key: "SIGNATURE", emoji: "✨", label: "시그니처", title: "시그니처 후원" },
    { key: "WISHLIST", emoji: "🎁", label: "위시", title: "위시리스트 후원" },
    { key: "LUCKYBOX", emoji: "🎲", label: "럭키박스", title: "럭키박스 후원" }
  ],
  minAmount: 1_000,
  voices: [{ id: "mina", emoji: "👧", name: "미나", description: "명랑한 보이스" }]
};
