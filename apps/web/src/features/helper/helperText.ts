import type { MessageKey } from "@/lib/i18n/translate";
import type { EditableWidgetKey } from "@/services/creator/widgetSettingsTypes";
import { HELPER_BRAND, type HelperNavItem } from "./helperNav";
import type { WidgetFeature } from "./widgetPages";

/**
 * 도우미 menu and widget page texts in the viewer's language (2026-11-01). `helperNav.ts` and `widgetPages.ts` stay plain
 * Korean data (the middleware imports them); these map their entries to messages by path, group title, feature and widget.
 */
type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** "Ssumnation 도우미" / "Ssumnation Helper". */
export const helperTitle = (t: T) => `${HELPER_BRAND.name} ${t("helper.product")}`;

const NAV_ITEM: Record<string, readonly [MessageKey, MessageKey]> = {
  "/": ["helperNav.home", "helperNav.homeDesc"],
  "/alert": ["helperNav.alert", "helperNav.alertDesc"],
  "/chat": ["helperNav.chat", "helperNav.chatDesc"],
  "/chat/manage": ["helperNav.chatManage", "helperNav.chatManageDesc"],
  "/goal": ["helperNav.goal", "helperNav.goalDesc"],
  "/subtitles": ["helperNav.subtitles", "helperNav.subtitlesDesc"],
  "/monitor": ["helperNav.monitor", "helperNav.monitorDesc"],
  "/clock": ["helperNav.clock", "helperNav.clockDesc"],
  "/qr": ["helperNav.qr", "helperNav.qrDesc"],
  "/tools": ["helperNav.tools", "helperNav.toolsDesc"],
  "/signatures": ["helperNav.signatures", "helperNav.signaturesDesc"],
  "/video": ["helperNav.video", "helperNav.videoDesc"],
  "/drawing": ["helperNav.drawing", "helperNav.drawingDesc"],
  "/effects": ["helperNav.effects", "helperNav.effectsDesc"],
  "/banner": ["helperNav.banner", "helperNav.bannerDesc"],
  "/wallpaper": ["helperNav.wallpaper", "helperNav.wallpaperDesc"],
  "/quest": ["helperNav.quest", "helperNav.questDesc"],
  "/vote": ["helperNav.vote", "helperNav.voteDesc"],
  "/roulette": ["helperNav.roulette", "helperNav.rouletteDesc"],
  "/gacha": ["helperNav.gacha", "helperNav.gachaDesc"],
  "/crew": ["helperNav.crew", "helperNav.crewDesc"],
  "/crew/broadcast": ["helperNav.crewBroadcast", "helperNav.crewBroadcastDesc"],
  "/crew/games": ["helperNav.crewGames", "helperNav.crewGamesDesc"],
  "/theme": ["helperNav.theme", "helperNav.themeDesc"],
  "/overlays": ["helperNav.overlays", "helperNav.overlaysDesc"],
  "/assets": ["helperNav.assets", "helperNav.assetsDesc"],
  "/link": ["helperNav.link", "helperNav.linkDesc"],
  "/youtube": ["helperNav.youtube", "helperNav.youtubeDesc"],
  "/filtering": ["helperNav.filtering", "helperNav.filteringDesc"]
};

const NAV_GROUP: Record<string, MessageKey> = {
  "방송 화면": "helperNav.groupScreen",
  "후원 콘텐츠": "helperNav.groupContent",
  게임센터: "helperNav.groupGames",
  "크루 방송": "helperNav.groupCrew",
  "연결 · 설정": "helperNav.groupSettings"
};

/** A menu entry's label and description; an entry without messages shows as written. */
export function helperNavText(item: HelperNavItem, t: T) {
  const keys = NAV_ITEM[item.href];
  return keys ? { label: t(keys[0]), description: t(keys[1]) } : { label: item.label, description: item.description };
}

export const helperGroupTitle = (title: string, t: T) => (NAV_GROUP[title] ? t(NAV_GROUP[title]) : title);

const FEATURE: Record<WidgetFeature, readonly [MessageKey, MessageKey]> = {
  alert: ["helperNav.alert", "helperWidgets.alertDesc"],
  chat: ["helperNav.chat", "helperWidgets.chatDesc"],
  goal: ["helperNav.goal", "helperWidgets.goalDesc"],
  subtitles: ["helperNav.subtitles", "helperWidgets.subtitlesDesc"],
  monitor: ["helperNav.monitor", "helperWidgets.monitorDesc"],
  clock: ["helperNav.clock", "helperWidgets.clockDesc"],
  qr: ["helperNav.qr", "helperWidgets.qrDesc"],
  wallpaper: ["helperNav.wallpaper", "helperWidgets.wallpaperDesc"],
  quest: ["helperNav.quest", "helperWidgets.questDesc"],
  vote: ["helperNav.vote", "helperWidgets.voteDesc"],
  roulette: ["helperNav.roulette", "helperWidgets.rouletteDesc"],
  gacha: ["helperNav.gacha", "helperWidgets.gachaDesc"]
};

const TAB: Record<EditableWidgetKey, MessageKey> = {
  ALERT: "helperWidgets.tabAlert",
  CUSTOM_SOUND: "helperWidgets.tabCustomSound",
  MINI: "helperWidgets.tabMini",
  CHAT: "helperNav.chat",
  GOAL: "helperWidgets.tabGoal",
  RANKING: "helperWidgets.tabRanking",
  TOTAL: "helperWidgets.tabTotal",
  RECENT: "helperWidgets.tabRecent",
  EVENT: "helperWidgets.tabEvent",
  TOP_DONATION: "helperWidgets.tabTopDonation",
  DONATION_MONITOR: "helperWidgets.tabDonationMonitor",
  SIG_QUEUE: "helperWidgets.tabSigQueue",
  SIG_WALLPAPER: "helperWidgets.tabSigWallpaper",
  CLOCK: "helperNav.clock",
  QR: "helperNav.qr",
  WALLPAPER: "helperNav.wallpaper",
  QUEST: "helperNav.quest",
  VOTE: "helperNav.vote",
  ROULETTE: "helperNav.roulette",
  GACHA: "helperNav.gacha"
};

const featureKeys = (feature: string) => (Object.hasOwn(FEATURE, feature) ? FEATURE[feature as WidgetFeature] : null);

/** A widget page's title and description (`WIDGET_PAGES`), or `fallback` for a feature without messages. */
export function widgetPageText(feature: string, fallback: { title: string; description: string }, t: T) {
  const keys = featureKeys(feature);
  return keys ? { title: t(keys[0]), description: t(keys[1]) } : fallback;
}

export const widgetTabLabel = (tab: { key: EditableWidgetKey; label: string }, t: T) => (TAB[tab.key] ? t(TAB[tab.key]) : tab.label);
