import { isOverlayMotion, isOverlayThemeChoice } from "./overlayThemeTypes";
import {
  ALERT_EFFECTS_IN,
  ALERT_HEADLINE_MAX,
  ALERT_LAYOUTS,
  ALERT_TOKENS,
  type AlertSettings,
  GACHA_BOARD_PERIODS,
  GACHA_BOARD_SPEEDS,
  GACHA_BOARD_TYPES,
  GACHA_MAX,
  GACHA_NAME_MAX,
  GACHA_PRIZES_MAX,
  GACHA_PRIZE_MODES,
  GACHA_STYLES,
  GACHA_THEMES,
  WALLPAPER_LAYOUTS,
  type Gacha,
  type GachaPrize,
  type GachaSettings,
  type WallpaperSettings,
  ROULETTE_DAILY_LIMIT_MAX,
  ROULETTE_ITEMS_MAX,
  ROULETTE_ITEMS_MIN,
  ROULETTE_ITEM_MAX_CHARS,
  ROULETTE_SPIN_SEC,
  type RouletteItem,
  type RouletteSettings,
  PRIZE_MAX,
  QUEST_STYLES,
  type ColorFont,
  type QuestWidgetSettings,
  ALERT_EFFECTS_OUT,
  CHAT_MAX_FILTERS,
  CHAT_MAX_LINES,
  CHAT_STYLES,
  EVENT_ORDERS,
  EVENT_STYLES,
  FONT_FAMILIES,
  FONT_SIZES,
  GOAL_AMOUNT_MAX,
  GOAL_STYLES,
  GOAL_TITLE_MAX,
  NICKNAME_BG,
  NICKNAME_MAX,
  QR_CAPTION_MAX,
  QR_STYLES,
  RANKING_BOARDS,
  RANKING_MAX_RANKS,
  RANKING_NAME_TYPES,
  RANKING_SPEEDS,
  RANKING_STYLES,
  RANKING_WIDGET_PERIODS,
  RECENT_EFFECTS,
  RECENT_PLATFORMS,
  RECENT_SCROLL_SPEEDS,
  TEMPLATE_MAX,
  TOTAL_TEMPLATE_MAX,
  TOTAL_TEMPLATE_TOKEN,
  TOTAL_TITLE_MAX,
  VOTE_COLORS,
  VOTE_DURATION_MAX_SEC,
  VOTE_ITEMS_MAX,
  VOTE_ITEMS_MIN,
  VOTE_ITEM_MAX_CHARS,
  VOTE_NAME_MAX,
  VOTE_PRESET_MAX,
  isHexColor,
  type ChatSettings,
  type EditableWidgetKey,
  type EventSettings,
  type FontSetting,
  type GoalSettings,
  type MiniSettings,
  type QrSettings,
  type RankTierStyle,
  type RankingSettings,
  type RecentPlatform,
  type RecentSettings,
  type TotalSettings,
  type VoteSettings,
  type WidgetSettingsMap
} from "./widgetSettingsTypes";
import { isIsoDate, isIsoDateTime } from "@/lib/period";

/**
 * Server-side validation for widget settings (used by ./widgetSettings.ts). Each parser rebuilds the
 * settings object from known fields only, or returns a user-facing error message.
 */

type Raw = Record<string, unknown>;
type Parser<T> = (v: Raw) => T | string;

const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);
const keyOf = <T extends { key: string }>(v: unknown, list: readonly T[]): v is T["key"] => list.some((o) => o.key === v);
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const text = (v: unknown, max: number, min = 0) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const isDate = isIsoDate;
const isDateTime = isIsoDateTime;

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

/** 후원 알림 디자인 (code-first): the headline needs {닉네임}; {금액} is optional. */
const parseAlert: Parser<AlertSettings> = (v) => {
  if (!isOverlayThemeChoice(v.theme)) return "테마를 골라 주세요.";
  if (!keyOf(v.layout, ALERT_LAYOUTS)) return "알림 모양을 골라 주세요.";
  if (!text(v.headline, ALERT_HEADLINE_MAX, 1) || !(v.headline as string).includes(ALERT_TOKENS.donor)) {
    return `알림 문구는 ${ALERT_TOKENS.donor}을 넣어 ${ALERT_HEADLINE_MAX}자 이내로 입력해 주세요.`;
  }
  if (!isOverlayMotion(v.motion)) return "등장 효과를 골라 주세요.";
  if (![v.showMessage, v.showBadges, v.showPlatform, v.showImage, v.countUp].every(bool)) return "설정 값을 확인해 주세요.";
  return {
    theme: v.theme,
    layout: v.layout,
    headline: (v.headline as string).trim(),
    showMessage: v.showMessage as boolean,
    showBadges: v.showBadges as boolean,
    showPlatform: v.showPlatform as boolean,
    showImage: v.showImage as boolean,
    motion: v.motion,
    countUp: v.countUp as boolean
  };
};

const parseChat: Parser<ChatSettings> = (v) => {
  const f = font(v.font, true);
  if (!f) return FONT_ERROR;
  if (!keyOf(v.style, CHAT_STYLES) || !keyOf(v.nicknameBackground, NICKNAME_BG)) return "선택 항목을 확인해 주세요.";
  if (!oneOf(v.effectIn, ALERT_EFFECTS_IN) || !oneOf(v.effectOut, ALERT_EFFECTS_OUT)) return "알림 효과를 확인해 주세요.";
  if (!int(v.maxLines, 1, CHAT_MAX_LINES)) return `채팅 최대 줄은 1~${CHAT_MAX_LINES}줄로 입력해 주세요.`;
  if (!int(v.hideAfterSec, 1, 3600)) return "감추기 시간은 1~3600초로 입력해 주세요.";
  if (![v.creatorNicknameColor, v.autoHide, v.hidePlatformIcon].every(bool)) return "설정 값을 확인해 주세요.";
  // Settings saved before 오버레이 테마 have no theme: 전체 테마 따르기.
  const theme = v.theme === undefined ? "INHERIT" : v.theme;
  if (!isOverlayThemeChoice(theme)) return "테마를 골라 주세요.";
  const filters = Array.isArray(v.filteredNicknames) ? v.filteredNicknames : null;
  if (!filters || filters.length > CHAT_MAX_FILTERS || !filters.every((n) => text(n, NICKNAME_MAX, 1))) {
    return `필터링 닉네임은 ${NICKNAME_MAX}자 이내로 최대 ${CHAT_MAX_FILTERS}개까지 추가할 수 있어요.`;
  }
  return {
    theme,
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


const templateOk = (v: unknown) => text(v, TEMPLATE_MAX, 1) && (v as string).includes("{nickname}");

const parseRecent: Parser<RecentSettings> = (v) => {
  const f = font(v.font, true);
  if (!f) return FONT_ERROR;
  if (!oneOf(v.effect, RECENT_EFFECTS)) return "알림 효과를 확인해 주세요.";
  if (!(RECENT_SCROLL_SPEEDS as readonly unknown[]).includes(v.scrollSpeedSec)) return "스크롤 이동 속도를 확인해 주세요.";
  if (!int(v.count, 1, 10)) return "표시 개수는 1~10개로 입력해 주세요.";
  if (!int(v.lineGap, 0, 50)) return "줄 간격은 0~50으로 입력해 주세요.";
  if (!bool(v.nicknameColor) || !bool(v.textOutline)) return "설정 값을 확인해 주세요.";
  const t = (typeof v.templates === "object" && v.templates !== null ? v.templates : {}) as Raw;
  if (!RECENT_PLATFORMS.every((p) => templateOk(t[p.key]))) return `알림 템플릿은 {nickname}을 포함해 ${TEMPLATE_MAX}자 이내로 입력해 주세요.`;
  const templates = Object.fromEntries(RECENT_PLATFORMS.map((p) => [p.key, (t[p.key] as string).trim()])) as Record<RecentPlatform, string>;
  return {
    effect: v.effect,
    count: v.count as number,
    lineGap: v.lineGap as number,
    scrollSpeedSec: v.scrollSpeedSec as RecentSettings["scrollSpeedSec"],
    font: f,
    nicknameColor: v.nicknameColor,
    textOutline: v.textOutline,
    templates
  };
};

const parseEvent: Parser<EventSettings> = (v) => {
  const f = font(v.font, true);
  if (!f) return FONT_ERROR;
  if (!keyOf(v.style, EVENT_STYLES) || !oneOf(v.order, EVENT_ORDERS) || !oneOf(v.effect, RECENT_EFFECTS)) return "선택 항목을 확인해 주세요.";
  if (!int(v.maxLines, 1, 20)) return "최대 표시 줄은 1~20줄로 입력해 주세요.";
  if (!int(v.hideAfterSec, 1, 3600)) return "감추기 시간은 1~3600초로 입력해 주세요.";
  if (![v.nicknameColor, v.nicknameBackground, v.autoHide].every(bool)) return "설정 값을 확인해 주세요.";
  return {
    style: v.style,
    order: v.order,
    effect: v.effect,
    font: f,
    nicknameColor: v.nicknameColor as boolean,
    nicknameBackground: v.nicknameBackground as boolean,
    maxLines: v.maxLines as number,
    autoHide: v.autoHide as boolean,
    hideAfterSec: v.hideAfterSec as number
  };
};

const parseMini: Parser<MiniSettings> = (v) => {
  const f = font(v.font, true);
  if (!f) return FONT_ERROR;
  if (!oneOf(v.style, ["SCROLL", "BUBBLE"] as const) || !oneOf(v.direction, ["RTL", "LTR"] as const)) return "선택 항목을 확인해 주세요.";
  if (!int(v.speed, 1, 100)) return "속도는 1~100으로 입력해 주세요.";
  if (!int(v.startPercent, 0, 100)) return "텍스트 시작 위치는 0~100%로 입력해 주세요.";
  if (!int(v.minAmount, 0, 1_000_000)) return "최소 표시 금액을 확인해 주세요.";
  if (![v.showAmount, v.showNickname, v.textOutline].every(bool)) return "설정 값을 확인해 주세요.";
  return {
    style: v.style,
    direction: v.direction,
    speed: v.speed as number,
    startPercent: v.startPercent as number,
    showAmount: v.showAmount as boolean,
    showNickname: v.showNickname as boolean,
    minAmount: v.minAmount as number,
    font: f,
    textOutline: v.textOutline as boolean
  };
};

function tier(v: unknown): RankTierStyle | null {
  const t = (typeof v === "object" && v !== null ? v : {}) as Raw;
  const f = font(t.font, true);
  if (!f || !isHexColor(t.accentColor)) return null;
  return { font: f, accentColor: t.accentColor.toUpperCase() };
}

const parseRanking: Parser<RankingSettings> = (v) => {
  const titleFont = font(v.titleFont, true);
  const first = tier(v.first);
  const others = tier(v.others);
  if (!titleFont || !first || !others) return "폰트/색상 설정을 확인해 주세요.";
  if (!keyOf(v.style, RANKING_STYLES) || !keyOf(v.nameType, RANKING_NAME_TYPES) || !keyOf(v.scrollSpeed, RANKING_SPEEDS)) return "선택 항목을 확인해 주세요.";
  // Settings saved before the boards existed have none: 후원자 랭킹.
  const board = v.board === undefined ? "DONOR" : v.board;
  if (!keyOf(board, RANKING_BOARDS)) return "랭킹 종류를 확인해 주세요.";
  if (!oneOf(v.period, RANKING_WIDGET_PERIODS)) return "산정 기간을 확인해 주세요.";
  if (!text(v.title, 20, 1)) return "위젯 제목은 1~20자로 입력해 주세요.";
  if (!bool(v.showAmount)) return "설정 값을 확인해 주세요.";
  if (!int(v.ranks, 1, RANKING_MAX_RANKS)) return `표시 등수는 1~${RANKING_MAX_RANKS}등으로 입력해 주세요.`;
  if (!int(v.scrollGap, 0, 200)) return "표시 간격은 0~200px로 입력해 주세요.";
  const fm = (typeof v.format === "object" && v.format !== null ? v.format : {}) as Raw;
  if (!text(fm.rank, 20) || !text(fm.name, 20) || !text(fm.amount, 20) || !(fm.name as string).includes("{name}")) {
    return "표시 메시지는 각 20자 이내로, 이름 칸에 {name}을 포함해 주세요.";
  }
  return {
    style: v.style,
    board,
    title: (v.title as string).trim(),
    titleFont,
    nameType: v.nameType,
    period: v.period,
    showAmount: v.showAmount,
    ranks: v.ranks as number,
    format: { rank: (fm.rank as string).trim(), name: (fm.name as string).trim(), amount: (fm.amount as string).trim() },
    scrollGap: v.scrollGap as number,
    scrollSpeed: v.scrollSpeed,
    first,
    others
  };
};

const parseVote: Parser<VoteSettings> = (v) => {
  const titleFont = font(v.titleFont, true);
  const infoFont = font(v.infoFont, true);
  const itemFont = font(v.itemFont, true);
  if (!titleFont || !infoFont || !itemFont) return FONT_ERROR;
  if (!bool(v.enabled)) return "설정 값을 확인해 주세요.";
  const presets = Array.isArray(v.presets) ? v.presets : null;
  if (!presets || presets.length > VOTE_PRESET_MAX) return `프리셋은 최대 ${VOTE_PRESET_MAX}개까지 만들 수 있어요.`;
  const out: VoteSettings["presets"] = [];
  for (const raw of presets) {
    const p = (typeof raw === "object" && raw !== null ? raw : {}) as Raw;
    if (typeof p.id !== "string" || !/^[\w-]{1,40}$/.test(p.id)) return "프리셋 정보를 확인해 주세요.";
    if (!text(p.name, VOTE_NAME_MAX)) return `투표 이름은 ${VOTE_NAME_MAX}자 이내로 입력해 주세요.`;
    if (!oneOf(p.color, VOTE_COLORS)) return "프리셋 색상을 확인해 주세요.";
    if (!int(p.durationSec, 10, VOTE_DURATION_MAX_SEC)) return "투표 시간은 00:00:10 ~ 24:00:00 사이로 입력해 주세요.";
    const items = Array.isArray(p.items) ? p.items : null;
    if (!items || items.length < VOTE_ITEMS_MIN || items.length > VOTE_ITEMS_MAX || !items.every((i) => text(i, VOTE_ITEM_MAX_CHARS))) {
      return `투표 항목은 ${VOTE_ITEMS_MIN}~${VOTE_ITEMS_MAX}개, 각 ${VOTE_ITEM_MAX_CHARS}자 이내로 입력해 주세요.`;
    }
    out.push({
      id: p.id,
      name: (p.name as string).trim(),
      color: p.color,
      durationSec: p.durationSec as number,
      items: (items as string[]).map((i) => i.trim())
    });
  }
  if (new Set(out.map((p) => p.id)).size !== out.length) return "프리셋 정보를 확인해 주세요.";
  return { enabled: v.enabled, titleFont, infoFont, itemFont, presets: out };
};

// ── 퀘스트 · 뽑기 · 룰렛 ───────────────────────────────────────────────────────

const obj = (v: unknown) => (typeof v === "object" && v !== null ? v : {}) as Raw;

function colorFont(v: unknown): ColorFont | null {
  const f = obj(v);
  if (!oneOf(f.family, FONT_FAMILIES) || !isHexColor(f.color)) return null;
  return { family: f.family, color: f.color.toUpperCase() };
}

const parseQuest: Parser<QuestWidgetSettings> = (v) => {
  const titleFont = colorFont(v.titleFont);
  const timeFont = colorFont(v.timeFont);
  const prizeFont = colorFont(v.prizeFont);
  if (!titleFont || !timeFont || !prizeFont) return "폰트/색상 설정을 확인해 주세요.";
  if (!keyOf(v.style, QUEST_STYLES)) return "위젯 스타일을 선택해 주세요.";
  if (![v.enabled, v.allowExtension, v.showSuccessAuthorityMenu].every(bool)) return "설정 값을 확인해 주세요.";
  if (!int(v.minAmount, 1, PRIZE_MAX)) return "후원 최소 FN을 확인해 주세요.";
  if (!int(v.maxCount, 1, 50)) return "최대 개수는 1~50개로 입력해 주세요.";
  if (!int(v.intervalSec, 0, 3600)) return "등록 간격시간은 0~3600초로 입력해 주세요.";
  return {
    enabled: v.enabled as boolean,
    style: v.style,
    titleFont,
    timeFont,
    prizeFont,
    minAmount: v.minAmount as number,
    maxCount: v.maxCount as number,
    intervalSec: v.intervalSec as number,
    allowExtension: v.allowExtension as boolean,
    showSuccessAuthorityMenu: v.showSuccessAuthorityMenu as boolean
  };
};

// ── 뽑기 후원 · 벽지 ───────────────────────────────────────────────────────────

const ID = /^[\w-]{1,40}$/;
const ASSET_ID = /^[\w-]{1,64}$/;

function parseGachaItem(raw: unknown): Gacha | string {
  const g = obj(raw);
  if (typeof g.id !== "string" || !ID.test(g.id)) return "뽑기 정보를 확인해 주세요.";
  if (!text(g.name, GACHA_NAME_MAX, 1)) return `뽑기 이름은 1~${GACHA_NAME_MAX}자로 입력해 주세요.`;
  if (!int(g.price, 1, PRIZE_MAX)) return "뽑기 가격을 확인해 주세요.";
  if (!keyOf(g.style, GACHA_STYLES) || !keyOf(g.theme, GACHA_THEMES) || !keyOf(g.prizeMode, GACHA_PRIZE_MODES)) return "선택 항목을 확인해 주세요.";
  if (!int(g.spinSec, 1, 30)) return "기계 회전 시간은 1~30초로 입력해 주세요.";
  if (!text(g.messageTemplate, TEMPLATE_MAX, 1) || !(g.messageTemplate as string).includes("{닉네임}")) {
    return `알림 메시지 템플릿은 {닉네임}을 포함해 ${TEMPLATE_MAX}자 이내로 입력해 주세요.`;
  }
  if (!isHexColor(g.pointColor)) return COLOR_ERROR;
  if (![g.enabled, g.limitEnabled].every(bool) || !int(g.limitCount, 1, 1000)) return "설정 값을 확인해 주세요.";
  // Older saved settings have no winSoundId; whether the sound is in the library is checked on save.
  if (g.winSoundId !== undefined && g.winSoundId !== null && (typeof g.winSoundId !== "string" || !ASSET_ID.test(g.winSoundId))) return "효과음을 다시 선택해 주세요.";
  const prizes = Array.isArray(g.prizes) ? g.prizes : null;
  if (!prizes || prizes.length < 1 || prizes.length > GACHA_PRIZES_MAX) return `상품은 1~${GACHA_PRIZES_MAX}개까지 등록할 수 있어요.`;
  const probability = g.prizeMode === "PROBABILITY";
  const out: GachaPrize[] = [];
  for (const rp of prizes) {
    const p = obj(rp);
    if (typeof p.id !== "string" || !ID.test(p.id) || !oneOf(p.kind, ["PRIZE", "BLANK"] as const)) return "상품 정보를 확인해 주세요.";
    if (!text(p.name, GACHA_NAME_MAX, 1)) return `상품 이름은 1~${GACHA_NAME_MAX}자로 입력해 주세요.`;
    if (!int(p.value, 0, probability ? 100 : 100_000)) return probability ? "확률은 0~100%로 입력해 주세요." : "상품 수량을 확인해 주세요.";
    // `drawn` is the draw count the form loaded (the save subtracts draws made since — gachaCore keepDrawnStock).
    if (p.drawn !== undefined && !int(p.drawn, 0, Number.MAX_SAFE_INTEGER)) return "상품 정보를 확인해 주세요.";
    out.push({ id: p.id, name: (p.name as string).trim(), kind: p.kind, value: p.value as number, ...(p.drawn !== undefined ? { drawn: p.drawn as number } : {}) });
  }
  if (probability && out.reduce((sum, p) => sum + p.value, 0) !== 100) return "당첨확률형은 상품 확률의 합이 100%여야 해요.";
  if (new Set(out.map((p) => p.id)).size !== out.length) return "상품 정보를 확인해 주세요.";
  return {
    id: g.id,
    name: (g.name as string).trim(),
    price: g.price as number,
    enabled: g.enabled as boolean,
    style: g.style,
    theme: g.theme,
    spinSec: g.spinSec as number,
    messageTemplate: (g.messageTemplate as string).trim(),
    pointColor: g.pointColor.toUpperCase(),
    limitEnabled: g.limitEnabled as boolean,
    limitCount: g.limitCount as number,
    prizeMode: g.prizeMode,
    prizes: out,
    winSoundId: typeof g.winSoundId === "string" ? g.winSoundId : null
  };
}

const parseGacha: Parser<GachaSettings> = (v) => {
  const list = Array.isArray(v.gachas) ? v.gachas : null;
  if (!list || list.length > GACHA_MAX) return `뽑기는 최대 ${GACHA_MAX}개까지 만들 수 있어요.`;
  const gachas: Gacha[] = [];
  for (const raw of list) {
    const g = parseGachaItem(raw);
    if (typeof g === "string") return g;
    gachas.push(g);
  }
  if (new Set(gachas.map((g) => g.id)).size !== gachas.length) return "뽑기 정보를 확인해 주세요.";
  const credit = obj(v.credit);
  if (!int(credit.historyCount, 1, 20) || !int(credit.displaySec, 1, 60)) return "크레딧 스타일 세부 설정을 확인해 주세요.";
  const board = obj(v.board);
  if (!keyOf(board.productType, GACHA_BOARD_TYPES) || !keyOf(board.speed, GACHA_BOARD_SPEEDS) || !oneOf(board.period, GACHA_BOARD_PERIODS)) {
    return "당첨 리스트 위젯 설정을 확인해 주세요.";
  }
  if (!text(board.title, 20, 1)) return "위젯 타이틀은 1~20자로 입력해 주세요.";
  return {
    gachas,
    credit: { historyCount: credit.historyCount as number, displaySec: credit.displaySec as number },
    board: { productType: board.productType, title: (board.title as string).trim(), period: board.period, speed: board.speed }
  };
};

/** 룰렛: 1,000 FN 최소 (게임 후원과 같은 하한) ~ PRIZE_MAX, 항목 2~10개 · 확률 정수 합 100. */
const parseRoulette: Parser<RouletteSettings> = (v) => {
  if (!bool(v.enabled) || !bool(v.autoStart) || !bool(v.autoReveal)) return "설정 값을 확인해 주세요.";
  if (!int(v.minAmount, 1_000, PRIZE_MAX)) return "최소 참여 금액은 1,000 FN 이상으로 입력해 주세요.";
  if (!int(v.dailyLimit, 0, ROULETTE_DAILY_LIMIT_MAX)) return `참여 가능 횟수는 0~${ROULETTE_DAILY_LIMIT_MAX}회로 입력해 주세요.`;
  if (!int(v.spinSec, ROULETTE_SPIN_SEC.min, ROULETTE_SPIN_SEC.max)) return `회전 시간은 ${ROULETTE_SPIN_SEC.min}~${ROULETTE_SPIN_SEC.max}초로 입력해 주세요.`;
  const items = Array.isArray(v.items) ? v.items : null;
  if (!items || items.length < ROULETTE_ITEMS_MIN || items.length > ROULETTE_ITEMS_MAX) return `룰렛 항목은 ${ROULETTE_ITEMS_MIN}~${ROULETTE_ITEMS_MAX}개로 만들어 주세요.`;
  const out: RouletteItem[] = [];
  for (const raw of items) {
    const it = obj(raw);
    if (typeof it.id !== "string" || !ID.test(it.id)) return "룰렛 항목 정보를 확인해 주세요.";
    if (!text(it.name, ROULETTE_ITEM_MAX_CHARS, 1)) return `항목 이름은 1~${ROULETTE_ITEM_MAX_CHARS}자로 입력해 주세요.`;
    if (!int(it.percent, 1, 100)) return "항목 확률은 1~100%로 입력해 주세요.";
    out.push({ id: it.id, name: (it.name as string).trim(), percent: it.percent as number });
  }
  if (out.reduce((sum, it) => sum + it.percent, 0) !== 100) return "항목 확률의 합이 100%가 되어야 해요.";
  if (new Set(out.map((it) => it.id)).size !== out.length) return "룰렛 항목 정보를 확인해 주세요.";
  return { enabled: v.enabled, minAmount: v.minAmount, dailyLimit: v.dailyLimit, items: out, spinSec: v.spinSec, autoStart: v.autoStart, autoReveal: v.autoReveal };
};

const parseWallpaper: Parser<Omit<WallpaperSettings, "images">> = (v) => {
  const fnFont = colorFont(v.fnFont);
  const nicknameFont = colorFont(v.nicknameFont);
  if (!fnFont || !nicknameFont) return "폰트/색상 설정을 확인해 주세요.";
  if (!keyOf(v.layout, WALLPAPER_LAYOUTS)) return "벽지 레이아웃을 선택해 주세요.";
  if (![v.fnOutline, v.nicknameColor, v.textBoxColor].every(isHexColor)) return COLOR_ERROR;
  if (!bool(v.preferDonationImage)) return "설정 값을 확인해 주세요.";
  return {
    layout: v.layout,
    fnFont,
    fnOutline: (v.fnOutline as string).toUpperCase(),
    preferDonationImage: v.preferDonationImage,
    nicknameFont,
    nicknameColor: (v.nicknameColor as string).toUpperCase(),
    textBoxColor: (v.textBoxColor as string).toUpperCase()
  };
};

/** WALLPAPER images are managed separately, so its parser returns the settings without them. */
export type ParsedSettings<K extends EditableWidgetKey> = K extends "WALLPAPER" ? Omit<WallpaperSettings, "images"> : WidgetSettingsMap[K];

export const PARSERS: { [K in Exclude<EditableWidgetKey, "CUSTOM_SOUND">]: Parser<ParsedSettings<K>> } = {
  ALERT: parseAlert,
  CHAT: parseChat,
  QR: parseQr,
  GOAL: parseGoal,
  TOTAL: parseTotal,
  RECENT: parseRecent,
  EVENT: parseEvent,
  MINI: parseMini,
  RANKING: parseRanking,
  VOTE: parseVote,
  QUEST: parseQuest,
  GACHA: parseGacha,
  ROULETTE: parseRoulette,
  WALLPAPER: parseWallpaper
};
