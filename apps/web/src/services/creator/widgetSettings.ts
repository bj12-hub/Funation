"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockCreator } from "./mockCreatorStore";
import {
  ALERT_EFFECTS_IN,
  ALERT_EFFECTS_OUT,
  CHAT_MAX_FILTERS,
  CHAT_MAX_LINES,
  CHAT_STYLES,
  DEFAULT_WIDGET_SETTINGS,
  FONT_FAMILIES,
  FONT_SIZES,
  GOAL_AMOUNT_MAX,
  GOAL_STYLES,
  GOAL_TITLE_MAX,
  NICKNAME_BG,
  NICKNAME_MAX,
  QR_CAPTION_MAX,
  QR_STYLES,
  TOTAL_TEMPLATE_MAX,
  TOTAL_TEMPLATE_TOKEN,
  TOTAL_TITLE_MAX,
  WIDGET_PATHS,
  isEditableWidget,
  isHexColor,
  type ChatSettings,
  type EditableWidgetKey,
  type FontSetting,
  type GoalSettings,
  type QrSettings,
  type TotalSettings,
  type WidgetDetail,
  type WidgetSaveResult,
  type WidgetSettingsMap
} from "./widgetSettingsTypes";

/**
 * Widget settings — Figma 529:4 + popups 531:* (route `/creator/widgets`).
 * Server Actions re-check the session and fully validate each payload (unknown keys are dropped).
 * TBD: creator role check, widget URL format/secret rotation, audit of setting changes.
 */

const globalForWidgets = globalThis as typeof globalThis & { __funationMockWidgets?: WidgetSettingsMap };
const store = (globalForWidgets.__funationMockWidgets ??= structuredClone(DEFAULT_WIDGET_SETTINGS));

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Widget settings API is not connected yet.");
};

export async function getWidgetDetail(key: unknown): Promise<WidgetDetail | null> {
  assertMock();
  if (!(await getSession()) || !isEditableWidget(key)) return null;
  await mockDelay(300);
  return {
    key,
    url: `https://funation.com/widget/${WIDGET_PATHS[key]}/${mockCreator.handle}`,
    settings: structuredClone(store[key]),
    live: { goalCurrent: 100_000, totalAmount: 250_000, qrImageUrl: "/mock/creator/widgets/qr-sample.png" }
  } as WidgetDetail;
}

export async function saveWidgetSettings(key: unknown, input: unknown): Promise<WidgetSaveResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!isEditableWidget(key)) return { status: "INVALID", message: "알 수 없는 위젯입니다." };
  const parsed = PARSERS[key](typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {});
  if (typeof parsed === "string") return { status: "INVALID", message: parsed };
  await mockDelay(400);
  (store as Record<EditableWidgetKey, unknown>)[key] = parsed;
  return { status: "SAVED" };
}

// ── Validation ───────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;
type Parser<T> = (v: Raw) => T | string;

const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);
const keyOf = <T extends { key: string }>(v: unknown, list: readonly T[]): v is T["key"] => list.some((o) => o.key === v);
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const text = (v: unknown, max: number, min = 0) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isDateTime = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function font(v: unknown, withColor: true): FontSetting | null;
function font(v: unknown, withColor: false): Omit<FontSetting, "color"> | null;
function font(v: unknown, withColor: boolean) {
  const f = (typeof v === "object" && v !== null ? v : {}) as Raw;
  if (!oneOf(f.family, FONT_FAMILIES) || !(FONT_SIZES as readonly unknown[]).includes(f.size)) return null;
  if (!withColor) return { family: f.family, size: f.size as number };
  if (!isHexColor(f.color)) return null;
  return { family: f.family, size: f.size as number, color: f.color.toUpperCase() };
}

const FONT_ERROR = "폰트 설정을 확인해 주세요.";
const COLOR_ERROR = "색상은 #RRGGBB 형식으로 입력해 주세요.";

const parseChat: Parser<ChatSettings> = (v) => {
  const f = font(v.font, true);
  if (!f) return FONT_ERROR;
  if (!keyOf(v.style, CHAT_STYLES) || !keyOf(v.nicknameBackground, NICKNAME_BG)) return "선택 항목을 확인해 주세요.";
  if (!oneOf(v.effectIn, ALERT_EFFECTS_IN) || !oneOf(v.effectOut, ALERT_EFFECTS_OUT)) return "알림 효과를 확인해 주세요.";
  if (!int(v.maxLines, 1, CHAT_MAX_LINES)) return `채팅 최대 줄은 1~${CHAT_MAX_LINES}줄로 입력해 주세요.`;
  if (!int(v.hideAfterSec, 1, 3600)) return "감추기 시간은 1~3600초로 입력해 주세요.";
  if (![v.creatorNicknameColor, v.autoHide, v.hidePlatformIcon].every(bool)) return "설정 값을 확인해 주세요.";
  const filters = Array.isArray(v.filteredNicknames) ? v.filteredNicknames : null;
  if (!filters || filters.length > CHAT_MAX_FILTERS || !filters.every((n) => text(n, NICKNAME_MAX, 1))) {
    return `필터링 닉네임은 ${NICKNAME_MAX}자 이내로 최대 ${CHAT_MAX_FILTERS}개까지 추가할 수 있어요.`;
  }
  return {
    style: v.style,
    effectIn: v.effectIn,
    effectOut: v.effectOut,
    font: f,
    creatorNicknameColor: v.creatorNicknameColor as boolean,
    nicknameBackground: v.nicknameBackground,
    maxLines: v.maxLines as number,
    autoHide: v.autoHide as boolean,
    hideAfterSec: v.hideAfterSec as number,
    hidePlatformIcon: v.hidePlatformIcon as boolean,
    filteredNicknames: [...new Set((filters as string[]).map((n) => n.trim()))]
  };
};

const parseQr: Parser<QrSettings> = (v) => {
  const f = font(v.captionFont, false);
  if (!f) return FONT_ERROR;
  if (!keyOf(v.codeStyle, QR_STYLES) || !oneOf(v.captionPosition, ["TOP", "BOTTOM"] as const)) return "선택 항목을 확인해 주세요.";
  if (!isHexColor(v.borderColor)) return COLOR_ERROR;
  if (!bool(v.centerLogo) || !bool(v.captionEnabled)) return "설정 값을 확인해 주세요.";
  if (!text(v.caption, QR_CAPTION_MAX, v.captionEnabled ? 1 : 0)) return `문구는 1~${QR_CAPTION_MAX}자로 입력해 주세요.`;
  return {
    codeStyle: v.codeStyle,
    borderColor: v.borderColor.toUpperCase(),
    centerLogo: v.centerLogo,
    captionEnabled: v.captionEnabled,
    caption: (v.caption as string).trim(),
    captionPosition: v.captionPosition,
    captionFont: f
  };
};

const parseGoal: Parser<GoalSettings> = (v) => {
  const f = font(v.font, false);
  if (!f) return FONT_ERROR;
  if (!keyOf(v.style, GOAL_STYLES)) return "위젯 스타일을 선택해 주세요.";
  if (!text(v.title, GOAL_TITLE_MAX, 1)) return `목표 제목은 1~${GOAL_TITLE_MAX}자로 입력해 주세요.`;
  if (!int(v.startAmount, 0, GOAL_AMOUNT_MAX) || !int(v.goalAmount, 1, GOAL_AMOUNT_MAX)) return "금액을 확인해 주세요.";
  if ((v.startAmount as number) >= (v.goalAmount as number)) return "목표 금액은 시작 금액보다 커야 해요.";
  if (!isDate(v.from) || !isDate(v.to) || v.from > v.to) return "산정 기간을 확인해 주세요.";
  if (!isHexColor(v.barColor) || !isHexColor(v.barBackground)) return COLOR_ERROR;
  if (!int(v.barHeight, 8, 120)) return "바 세로 크기는 8~120px로 입력해 주세요.";
  if (!bool(v.showPercent) || !bool(v.textOutline)) return "설정 값을 확인해 주세요.";
  return {
    style: v.style,
    title: (v.title as string).trim(),
    startAmount: v.startAmount as number,
    goalAmount: v.goalAmount as number,
    from: v.from,
    to: v.to,
    showPercent: v.showPercent,
    barColor: v.barColor.toUpperCase(),
    barBackground: v.barBackground.toUpperCase(),
    barHeight: v.barHeight as number,
    textOutline: v.textOutline,
    font: f
  };
};

const parseTotal: Parser<TotalSettings> = (v) => {
  const titleFont = font(v.titleFont, true);
  const contentFont = font(v.contentFont, true);
  if (!titleFont || !contentFont) return FONT_ERROR;
  if (!text(v.title, TOTAL_TITLE_MAX, 1)) return `제목은 1~${TOTAL_TITLE_MAX}자로 입력해 주세요.`;
  if (!text(v.template, TOTAL_TEMPLATE_MAX, 1) || !(v.template as string).includes(TOTAL_TEMPLATE_TOKEN)) {
    return `내용 템플릿에 ${TOTAL_TEMPLATE_TOKEN}을 포함해 주세요.`;
  }
  if (!isDateTime(v.from) || !isDateTime(v.to) || v.from > v.to) return "산정 기간을 확인해 주세요.";
  if (!bool(v.textOutline)) return "설정 값을 확인해 주세요.";
  return { title: (v.title as string).trim(), template: (v.template as string).trim(), from: v.from, to: v.to, titleFont, contentFont, textOutline: v.textOutline };
};

const PARSERS: { [K in EditableWidgetKey]: Parser<WidgetSettingsMap[K]> } = { CHAT: parseChat, QR: parseQr, GOAL: parseGoal, TOTAL: parseTotal };
