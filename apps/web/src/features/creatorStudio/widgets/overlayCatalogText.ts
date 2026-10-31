import { ko } from "@/lib/i18n/messages/ko";
import type { MessageKey } from "@/lib/i18n/translate";
import type { OverlayEntry } from "@/services/creator/overlayCatalog";

type T = (key: MessageKey) => string;

const TITLES: Record<string, string> = ko.studioToolsOverlayTitles;
const DESCS: Record<string, string> = ko.studioToolsOverlayDescs;
const GROUPS: Record<string, MessageKey> = {
  채팅: "studioToolsOverlays.groupChat",
  알림: "studioToolsOverlays.groupAlerts",
  "점수·순위": "studioToolsOverlays.groupScores",
  "표시·자막": "studioToolsOverlays.groupDisplay",
  타이머: "studioToolsOverlays.groupTimer",
  기타: "studioToolsOverlays.groupOther",
  "세로 방송": "studioToolsOverlays.groupVertical"
};
/** The recommended sizes that carry words; the rest are numbers only. */
const SIZES: Record<string, MessageKey> = {
  "widget-sig-queue": "studioToolsOverlays.sizeSigQueue",
  "widget-sig-wallpaper": "studioToolsOverlays.sizeSigWallpaper"
};
const SIZE_TEXT: Record<string, string> = { "widget-sig-queue": ko.studioToolsOverlays.sizeSigQueue, "widget-sig-wallpaper": ko.studioToolsOverlays.sizeSigWallpaper };

/**
 * The 오버레이 주소 catalog (`services/creator/overlayCatalog`) in the viewer's language, by overlay id (2026-11-01). The
 * catalog stays as written (OBS scene and source names use it); an entry the messages don't know, or whose Korean has
 * changed since, shows as written.
 */
export const overlayTitle = (o: Pick<OverlayEntry, "id" | "title">, t: T) => (TITLES[o.id] === o.title ? t(`studioToolsOverlayTitles.${o.id}` as MessageKey) : o.title);
export const overlayDescription = (o: Pick<OverlayEntry, "id" | "description">, t: T) =>
  DESCS[o.id] === o.description ? t(`studioToolsOverlayDescs.${o.id}` as MessageKey) : o.description;
export const overlayGroup = (group: string, t: T) => (GROUPS[group] ? t(GROUPS[group]) : group);
/** The recommended OBS size as shown (it still starts with "W × H", which the preview reads). */
export const overlaySize = (o: Pick<OverlayEntry, "id" | "size">, t: T) => (SIZES[o.id] && SIZE_TEXT[o.id] === o.size ? t(SIZES[o.id]) : o.size);
