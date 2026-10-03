/**
 * 후원 위젯 OBS overlays (code-first): 후원목표 · 후원누적금액 · 후원랭킹 · 최근알림 · 이벤트 · 후원 QR코드.
 * Each reads its saved widget settings plus the creator's donation feed at
 * `/overlay/widget/[widget]/[integrationKey]`. Client-safe types only.
 */
import type { Platform } from "@/types/platform";
import type { AlertKind, OverlaySignal } from "./alertTypes";
import type { EventSettings, GoalSettings, QrSettings, RankingSettings, RecentSettings, TotalSettings, WidgetKey } from "./widgetSettingsTypes";

export const WIDGET_OVERLAYS = ["goal", "total", "ranking", "recent", "event", "qr"] as const;
export type WidgetOverlayKind = (typeof WIDGET_OVERLAYS)[number];
export const isWidgetOverlay = (v: unknown): v is WidgetOverlayKind => WIDGET_OVERLAYS.includes(v as WidgetOverlayKind);

/** Which saved widget settings each overlay reads. */
export const WIDGET_OVERLAY_SETTINGS: Record<WidgetOverlayKind, WidgetKey> = {
  goal: "GOAL",
  total: "TOTAL",
  ranking: "RANKING",
  recent: "RECENT",
  event: "EVENT",
  qr: "QR"
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

type Common = OverlaySignal & { serverNow: string };

export type OverlayWidget = Common &
  (
    | { widget: "goal"; settings: GoalSettings; current: number; percent: number; daysLeft: number | null }
    | { widget: "total"; settings: TotalSettings; total: number }
    | { widget: "ranking"; settings: RankingSettings; rows: WidgetRankRow[] }
    | { widget: "recent"; settings: RecentSettings; lines: WidgetFeedLine[] }
    | { widget: "event"; settings: EventSettings; lines: WidgetFeedLine[] }
    | { widget: "qr"; settings: QrSettings; imageUrl: string }
  );
