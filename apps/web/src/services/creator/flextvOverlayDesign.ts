import type { DonationTypeSettings } from "./donationTypeSettings";
import { DEFAULT_OVERLAY_APPEARANCE, isHex6, isOverlayTheme, isOverlayThemeChoice, type OverlayAppearance, type OverlayThemeChoice } from "./overlayThemeTypes";
import { PARSERS } from "./widgetParsers";
import {
  DEFAULT_WIDGET_SETTINGS,
  GACHA_BOARD_SPEEDS,
  GACHA_MAX,
  GACHA_STYLES,
  isHexColor,
  type Gacha,
  type GachaSettings,
  type GachaStyle,
  type MiniSettings,
  type QuestWidgetSettings,
  type RouletteSettings
} from "./widgetSettingsTypes";

/**
 * The overlay design with FLEXTV (phase 8, docs/development/flextv-ssumnation-api.md §10): Ssumnation's 오버레이 테마 and
 * the look of the overlays FLEXTV runs (룰렛 · 뽑기 · 당첨 리스트 · 퀘스트 · 미니), kept by FLEXTV as one document per
 * streamer. FLEXTV keeps it as it is given; Ssumnation checks it on the way in (`designPartOf`) and reads it leniently
 * on the way out (`readDesign`), so a field it cannot use is its default. The rules — items, odds, prices, minimums —
 * are 후원 종류 설정's (§5), never here.
 */

export const DESIGN_VERSION = 1;
/** The widgets whose look is set with FLEXTV. */
export const DESIGN_WIDGETS = ["ROULETTE", "GACHA", "QUEST", "MINI"] as const;
export type DesignWidget = (typeof DESIGN_WIDGETS)[number];
export const isDesignWidget = (value: unknown): value is DesignWidget => DESIGN_WIDGETS.includes(value as DesignWidget);

export type GachaLook = { style: GachaStyle; pointColor: string };
type QuestLook = Pick<QuestWidgetSettings, "theme" | "enabled" | "style" | "titleFont" | "timeFont" | "prizeFont" | "maxCount">;

export type FlextvOverlayDesign = {
  appearance: OverlayAppearance;
  roulette: { theme: OverlayThemeChoice };
  gacha: {
    theme: OverlayThemeChoice;
    credit: GachaSettings["credit"];
    board: Pick<GachaSettings["board"], "title" | "speed">;
    /** Per 뽑기, by FLEXTV's 뽑기 id. */
    looks: Record<string, GachaLook>;
  };
  quest: QuestLook;
  mini: MiniSettings;
};

const D = DEFAULT_WIDGET_SETTINGS;
const DEFAULT_LOOK: GachaLook = { style: D.GACHA.gachas[0].style, pointColor: D.GACHA.gachas[0].pointColor };
const questLook = (q: QuestWidgetSettings): QuestLook => ({ theme: q.theme, enabled: q.enabled, style: q.style, titleFont: q.titleFont, timeFont: q.timeFont, prizeFont: q.prizeFont, maxCount: q.maxCount });

export const DEFAULT_DESIGN: FlextvOverlayDesign = {
  appearance: DEFAULT_OVERLAY_APPEARANCE,
  roulette: { theme: D.ROULETTE.theme },
  gacha: { theme: D.GACHA.overlayTheme, credit: D.GACHA.credit, board: { title: D.GACHA.board.title, speed: D.GACHA.board.speed }, looks: {} },
  quest: questLook(D.QUEST),
  mini: D.MINI
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const GACHA_ID = /^[\w-]{1,40}$/;

export function parseAppearance(value: unknown): OverlayAppearance | string {
  const v = isRecord(value) ? value : {};
  if (!isOverlayTheme(v.theme)) return "테마를 골라 주세요.";
  if (v.accent !== null && !(typeof v.accent === "string" && isHex6(v.accent))) return "포인트 색상은 #RRGGBB 형식으로 입력해 주세요.";
  return { theme: v.theme, accent: typeof v.accent === "string" ? v.accent.toUpperCase() : null };
}

function parseLooks(value: unknown): Record<string, GachaLook> | string {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value);
  if (entries.length > GACHA_MAX) return `뽑기는 최대 ${GACHA_MAX}개까지 만들 수 있어요.`;
  const looks: Record<string, GachaLook> = {};
  for (const [id, look] of entries) {
    const l = isRecord(look) ? look : {};
    if (!GACHA_ID.test(id) || !GACHA_STYLES.some((s) => s.key === l.style) || !isHexColor(l.pointColor)) return "뽑기 모양을 확인해 주세요.";
    looks[id] = { style: l.style as GachaStyle, pointColor: (l.pointColor as string).toUpperCase() };
  }
  return looks;
}

function parseGachaLook(value: unknown): FlextvOverlayDesign["gacha"] | string {
  const v = isRecord(value) ? value : {};
  if (!isOverlayThemeChoice(v.theme)) return "테마를 골라 주세요.";
  const credit = isRecord(v.credit) ? v.credit : {};
  if (!int(credit.historyCount, 1, 20) || !int(credit.displaySec, 1, 60)) return "크레딧 스타일 세부 설정을 확인해 주세요.";
  const board = isRecord(v.board) ? v.board : {};
  if (typeof board.title !== "string" || board.title.trim().length < 1 || board.title.trim().length > 20) return "위젯 타이틀은 1~20자로 입력해 주세요.";
  if (!GACHA_BOARD_SPEEDS.some((s) => s.key === board.speed)) return "당첨 리스트 위젯 설정을 확인해 주세요.";
  const looks = parseLooks(v.looks);
  if (typeof looks === "string") return looks;
  return {
    theme: v.theme,
    credit: { historyCount: credit.historyCount, displaySec: credit.displaySec },
    board: { title: board.title.trim(), speed: board.speed as GachaSettings["board"]["speed"] },
    looks
  };
}

function parseQuestLook(value: unknown): QuestLook | string {
  // The widget's other settings are the rules', set in 후원 종류 설정: their defaults satisfy the parser.
  const parsed = PARSERS.QUEST({ ...D.QUEST, ...(isRecord(value) ? value : {}) });
  return typeof parsed === "string" ? parsed : questLook(parsed);
}

function parseMini(value: unknown): MiniSettings | string {
  return PARSERS.MINI(isRecord(value) ? value : {});
}

/**
 * The look of `key` in the settings the studio's form sends, or the reason it is refused. The form edits the whole
 * widget settings object; only its look is taken.
 */
export function designPartOf(key: DesignWidget, settings: unknown): Partial<FlextvOverlayDesign> | string {
  const v = isRecord(settings) ? settings : {};
  switch (key) {
    case "ROULETTE":
      return isOverlayThemeChoice(v.theme) ? { roulette: { theme: v.theme } } : "테마를 골라 주세요.";
    case "GACHA": {
      const gachas = Array.isArray(v.gachas) ? v.gachas.filter(isRecord) : [];
      const looks = Object.fromEntries(gachas.map((g) => [g.id, { style: g.style, pointColor: g.pointColor }]));
      const gacha = parseGachaLook({ theme: v.overlayTheme, credit: v.credit, board: v.board, looks });
      return typeof gacha === "string" ? gacha : { gacha };
    }
    case "QUEST": {
      const quest = parseQuestLook(v);
      return typeof quest === "string" ? quest : { quest };
    }
    case "MINI": {
      const mini = parseMini(v);
      return typeof mini === "string" ? mini : { mini };
    }
  }
}

/** A document as FLEXTV keeps it, as Ssumnation can use it: a part it cannot read is the default. */
export function readDesign(raw: unknown): FlextvOverlayDesign {
  const v = isRecord(raw) ? raw : {};
  const or = <T>(parsed: T | string, fallback: T) => (typeof parsed === "string" ? fallback : parsed);
  const roulette = isRecord(v.roulette) && isOverlayThemeChoice(v.roulette.theme) ? { theme: v.roulette.theme } : DEFAULT_DESIGN.roulette;
  return {
    appearance: or(parseAppearance(v.appearance), DEFAULT_DESIGN.appearance),
    roulette,
    gacha: or(parseGachaLook(v.gacha), DEFAULT_DESIGN.gacha),
    quest: or(parseQuestLook(v.quest), DEFAULT_DESIGN.quest),
    mini: or(parseMini(v.mini), DEFAULT_DESIGN.mini)
  };
}

/** The document FLEXTV is given. */
export const designBody = (design: FlextvOverlayDesign) => ({ version: DESIGN_VERSION, ...design });

export const lookOf = (design: FlextvOverlayDesign, gachaId: string | null): GachaLook => (gachaId && design.gacha.looks[gachaId]) || DEFAULT_LOOK;

/** A FLEXTV 뽑기 (후원 종류 설정) as the widget form shows it, with its look. */
function gachaOf(g: DonationTypeSettings["gacha"][number], look: GachaLook, index: number): Gacha {
  const base = D.GACHA.gachas[0];
  return {
    ...base,
    id: g.id ?? `new-${index}`,
    name: g.name,
    price: g.price,
    enabled: g.enabled,
    style: look.style,
    pointColor: look.pointColor,
    limitEnabled: g.limit !== null,
    limitCount: g.limit ?? 1,
    prizeMode: g.mode,
    prizes: g.prizes.map((p, i) => ({ id: `p-${i}`, name: p.name, kind: p.blank ? "BLANK" : "PRIZE", value: (g.mode === "PROBABILITY" ? p.percent : p.left) ?? 0 })),
    winSoundId: null
  };
}

/**
 * The widget settings the studio's form edits and the overlays draw with: the defaults with the design applied, and
 * the rules of 후원 종류 설정 where a preview shows them (룰렛's items, the 뽑기 list).
 */
export function designedSettings(design: FlextvOverlayDesign, types: DonationTypeSettings | null) {
  const roulette: RouletteSettings = {
    ...D.ROULETTE,
    theme: design.roulette.theme,
    ...(types ? { enabled: types.roulette.enabled, minAmount: types.roulette.minAmount, dailyLimit: types.roulette.dailyLimit, items: types.roulette.items.map((it, i) => ({ id: `ri-${i}`, ...it })) } : {})
  };
  const gacha: GachaSettings = {
    ...D.GACHA,
    overlayTheme: design.gacha.theme,
    gachas: (types?.gacha ?? []).map((g, i) => gachaOf(g, lookOf(design, g.id), i)),
    credit: design.gacha.credit,
    board: { ...D.GACHA.board, ...design.gacha.board }
  };
  const quest: QuestWidgetSettings = { ...D.QUEST, ...design.quest, ...(types ? { allowExtension: types.quest.allowExtension } : {}) };
  return { ROULETTE: roulette, GACHA: gacha, QUEST: quest, MINI: design.mini };
}
