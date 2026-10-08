/**
 * 후원 위젯 OBS overlays (code-first): 후원목표 · 후원누적금액 · 후원랭킹 · 최근알림 · 이벤트 · 후원 QR코드 · 퀘스트 · 투표 · 룰렛 · 뽑기 · 뽑기 당첨 리스트 · 벽지.
 * Each reads its saved widget settings plus the creator's donation feed at
 * `/overlay/widget/[widget]/[integrationKey]`. Client-safe types only.
 */
import type { Platform } from "@/types/platform";
import type { ResolvedTheme } from "./overlayThemeTypes";
import type { AlertKind, OverlaySignal } from "./alertTypes";
import type { GachaBoardView, GachaStage } from "@/services/donations/gachaTypes";
import type { RouletteStage } from "@/services/donations/rouletteTypes";
import type { VoteBoard } from "@/services/votes/voteTypes";
import type { EventSettings, GachaSettings, GoalSettings, QrSettings, QuestWidgetSettings, RankingSettings, RecentSettings, RouletteSettings, TotalSettings, VoteSettings, WallpaperSettings, WidgetKey } from "./widgetSettingsTypes";

export const WIDGET_OVERLAYS = ["goal", "total", "ranking", "recent", "event", "qr", "quest", "vote", "roulette", "gacha", "gacha-board", "wallpaper"] as const;
export type WidgetOverlayKind = (typeof WIDGET_OVERLAYS)[number];
export const isWidgetOverlay = (v: unknown): v is WidgetOverlayKind => WIDGET_OVERLAYS.includes(v as WidgetOverlayKind);

/** Which saved widget settings each overlay reads. */
export const WIDGET_OVERLAY_SETTINGS: Record<WidgetOverlayKind, WidgetKey> = {
  goal: "GOAL",
  total: "TOTAL",
  ranking: "RANKING",
  recent: "RECENT",
  event: "EVENT",
  qr: "QR",
  quest: "QUEST",
  vote: "VOTE",
  roulette: "ROULETTE",
  gacha: "GACHA",
  "gacha-board": "GACHA",
  wallpaper: "WALLPAPER"
};

/** Mock QR image (the popup preview uses the same one). TBD: a real QR for the creator's donation page. */
export const QR_SAMPLE_IMAGE = "/mock/creator/widgets/qr-sample.png";

export const widgetOverlayPath = (widget: WidgetOverlayKind, key: string) => `/overlay/widget/${widget}/${key}`;

/** One donation in 최근알림 · 이벤트. `platform` null = a Ssumnation (FN) donation. */
export type WidgetFeedLine = {
  id: string;
  kind: AlertKind;
  at: string;
  nickname: string;
  platform: Platform | null;
  /** "5,000 FN" or the platform's own amount (no FN conversion — TBD). */
  amount: string;
  /** The filled line around the nickname, e.g. "" · "님이 5,000 FN 후원했습니다." */
  before: string;
  after: string;
};

/** 벽지: the full-screen OBS source the stickers are placed on. */
export const WALL_SIZE = { w: 1920, h: 1080 } as const;

/**
 * One sticker on the 벽지. `image` indexes the overlay's 벽지 `images` (sent once, not per sticker), null = none
 * registered; `imageUrl` is the donation's own image (시그니처) used instead when "후원 이미지 우선" is on.
 */
export type WallSticker = { id: string; x: number; y: number; rotate: number; image: number | null; imageUrl: string | null; nickname: string; amount: string; test: boolean };

/** `amountLabel` replaces the FN amount (수단별 보드: each platform in its own unit). */
export type WidgetRankRow = { rank: number; name: string; fnAmount: number; amountLabel?: string };

/** A running quest on the 퀘스트 overlay; `endsAt` = sent time + 제한 시간. */
export type WidgetQuest = { id: string; title: string; amount: number; endsAt: string };

/** `theme`: the widget's 오버레이 테마 (its own choice, or the channel's 전체 테마). */
type Common = OverlaySignal & { serverNow: string; theme: ResolvedTheme };

export type OverlayWidget = Common &
  (
    /** `second` = 두 번째 목표 progress (null when off), shown in turn with the first. */
    | { widget: "goal"; settings: GoalSettings; current: number; percent: number; daysLeft: number | null; second: { current: number; percent: number } | null }
    | { widget: "total"; settings: TotalSettings; total: number }
    | { widget: "ranking"; settings: RankingSettings; rows: WidgetRankRow[] }
    | { widget: "recent"; settings: RecentSettings; lines: WidgetFeedLine[] }
    | { widget: "event"; settings: EventSettings; lines: WidgetFeedLine[] }
    | { widget: "qr"; settings: QrSettings; imageUrl: string }
    | { widget: "quest"; settings: QuestWidgetSettings; quests: WidgetQuest[] }
    /** `vote` null = no vote on screen. */
    | { widget: "vote"; settings: VoteSettings; vote: VoteBoard | null }
    /** `stage` null = the wheel is idle (nothing on screen). */
    | { widget: "roulette"; settings: RouletteSettings; stage: RouletteStage | null }
    /** `history` = the latest prizes for the 크레딧 style. */
    | { widget: "gacha"; settings: GachaSettings; stage: GachaStage | null; history: { donor: string; prize: string }[] }
    | { widget: "gacha-board"; settings: GachaSettings; board: GachaBoardView }
    /** 벽지 (2026-10-04 결정: 자동 배치 스티커 벽): stickers placed by the server on the 1920 × 1080 screen. */
    | { widget: "wallpaper"; settings: Omit<WallpaperSettings, "images">; images: string[]; stickers: WallSticker[] }
  );
