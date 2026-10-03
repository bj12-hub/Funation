/**
 * 후원 위젯 OBS overlays (code-first): 후원목표 · 후원누적금액 · 후원랭킹 · 최근알림 · 이벤트 · 후원 QR코드 · 퀘스트 · 투표 · 룰렛.
 * Each reads its saved widget settings plus the creator's donation feed at
 * `/overlay/widget/[widget]/[integrationKey]`. Client-safe types only.
 */
import type { Platform } from "@/types/platform";
import type { AlertKind, OverlaySignal } from "./alertTypes";
import type { RouletteStage } from "@/services/donations/rouletteTypes";
import type { VoteBoard } from "@/services/votes/voteTypes";
import type { EventSettings, GoalSettings, QrSettings, QuestWidgetSettings, RankingSettings, RecentSettings, RouletteSettings, TotalSettings, VoteSettings, WidgetKey } from "./widgetSettingsTypes";

export const WIDGET_OVERLAYS = ["goal", "total", "ranking", "recent", "event", "qr", "quest", "vote", "roulette"] as const;
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
  roulette: "ROULETTE"
};

/** Mock QR image (the popup preview uses the same one). TBD: a real QR for the creator's donation page. */
export const QR_SAMPLE_IMAGE = "/mock/creator/widgets/qr-sample.png";

export const widgetOverlayPath = (widget: WidgetOverlayKind, key: string) => `/overlay/widget/${widget}/${key}`;

/** One donation in 최근알림 · 이벤트. `platform` null = a Somnation (FN) donation. */
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

export type WidgetRankRow = { rank: number; name: string; fnAmount: number };

/** A running quest on the 퀘스트 overlay; `endsAt` = sent time + 제한 시간. */
export type WidgetQuest = { id: string; title: string; amount: number; endsAt: string };

type Common = OverlaySignal & { serverNow: string };

export type OverlayWidget = Common &
  (
    | { widget: "goal"; settings: GoalSettings; current: number; percent: number; daysLeft: number | null }
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
  );
