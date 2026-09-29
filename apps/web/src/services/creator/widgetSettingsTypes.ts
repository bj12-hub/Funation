/**
 * 후원위젯/알림설정 — Figma 529:4 (page) and the widget popups in 531:* (route `/creator/widgets`).
 * Client-safe catalog, setting shapes and defaults. The actions live in ./widgetSettings.ts.
 *
 * Defaults follow the design's sample values. Font list, size range and URL format are TBD.
 */

export type AlertKey = "TEXT" | "SIGNATURE" | "VOICE" | "VIDEO" | "ROULETTE" | "VOTE" | "QUEST" | "DRAWING" | "LUCKYBOX" | "PLAY";

export type WidgetKey =
  | "CHAT"
  | "QR"
  | "GOAL"
  | "TOTAL"
  | "RECENT"
  | "EVENT"
  | "MINI"
  | "RANKING"
  | "CUSTOM_SOUND"
  | "VOTE"
  | "QUEST"
  | "DRAWING"
  | "LUCKYBOX"
  | "PLAY"
  | "GACHA"
  | "WALLPAPER";

export type CatalogCard<K extends string> = { key: K; emoji: string; color: string; title: string; description: string };

/** 529:4 "후원 알림 설정". No popups are designed for these yet. */
export const ALERT_CARDS: CatalogCard<AlertKey>[] = [
  { key: "TEXT", emoji: "💬", color: "#3b82f6", title: "텍스트 후원 알림", description: "텍스트로 후원 메시지를 받으며 도네이터와 소통할 수 있습니다." },
  { key: "SIGNATURE", emoji: "⭐", color: "#f97316", title: "시그니처 후원 알림", description: "지정한 시그니처 리액션을 선택해서 후원할 수 있습니다." },
  { key: "VOICE", emoji: "🎙️", color: "#8b5cf6", title: "음성 후원 알림", description: "녹음한 음성 또는 자막독음을 통하여 후원 메시지를 받을 수 있습니다." },
  { key: "VIDEO", emoji: "📹", color: "#f97316", title: "영상 후원 알림", description: "후원과 함께 공유한 영상을 받아 볼 수 있습니다." },
  { key: "ROULETTE", emoji: "🎡", color: "#8b5cf6", title: "룰렛 후원 알림", description: "여러가지 항목을 설정하여 룰렛을 돌릴 수 있습니다." },
  { key: "VOTE", emoji: "🗳️", color: "#737385", title: "투표 알림", description: "도네이터들의 의견을 투표를 통해 받을 수 있습니다." },
  { key: "QUEST", emoji: "🚩", color: "#10b981", title: "퀘스트 알림", description: "도네이터들의 요구를 퀘스트를 통해 듣고 수행해 나갈 수 있습니다." },
  { key: "DRAWING", emoji: "🎨", color: "#8b5cf6", title: "그림 후원 알림", description: "도네이터가 직접 그린 그림을 통해 소통할 수 있습니다." },
  { key: "LUCKYBOX", emoji: "❓", color: "#ec4899", title: "럭키박스 알림", description: "도네이터들이 보내준 럭키박스를 통해 함께 즐기며 소통할 수 있습니다." },
  { key: "PLAY", emoji: "🕹️", color: "#10b981", title: "플레이 후원 알림", description: "퀴즈와 같은 재미있고 다양한 방법으로 도네이터와 소통할 수 있습니다." }
];

/** 529:4 "후원 위젯 설정". */
export const WIDGET_CARDS: CatalogCard<WidgetKey>[] = [
  { key: "CHAT", emoji: "💬", color: "#3b82f6", title: "채팅창", description: "방송화면에 채팅창을 띄워 소통하며 볼 수 있습니다." },
  { key: "QR", emoji: "🔲", color: "#0d9488", title: "후원 QR코드", description: "QR코드가 방송화면에 항상 노출되게 해보세요." },
  { key: "GOAL", emoji: "🎯", color: "#1e3a8a", title: "후원목표", description: "목표금액을 설정하여 시청자와 소통해 보세요." },
  { key: "TOTAL", emoji: "🐷", color: "#84cc16", title: "후원누적금액", description: "실시간 기간 동안 누적된 후원 금액을 화면에 노출합니다." },
  { key: "RECENT", emoji: "🔔", color: "#d97706", title: "최근알림", description: "최근 후원 혹은 피드에 흐르는 텍스트로 노출합니다." },
  { key: "EVENT", emoji: "🎉", color: "#ec4899", title: "이벤트", description: "후원 및 각종 알림 등을 나열하여 노출합니다." },
  { key: "MINI", emoji: "🪙", color: "#6b7280", title: "미니후원", description: "1,000FN 미만의 소액후원을 받을 수 있도록 설정합니다." },
  { key: "RANKING", emoji: "👑", color: "#8b5cf6", title: "후원랭킹", description: "후원금을 기준으로 순위를 화면에 노출합니다." },
  { key: "CUSTOM_SOUND", emoji: "🔊", color: "#8b5cf6", title: "커스텀 사운드", description: "크리에이터가 지정한 단어가 발화될 때 특별한 음성효과를 재생합니다." },
  { key: "VOTE", emoji: "📊", color: "#737385", title: "투표", description: "실시간 투표 현황을 위젯으로 방송에 띄웁니다." },
  { key: "QUEST", emoji: "⚔️", color: "#10b981", title: "퀘스트", description: "현재 진행 중인 후원 미션/퀘스트 목록을 노출합니다." },
  { key: "DRAWING", emoji: "🖼️", color: "#8b5cf6", title: "그림후원", description: "받은 그림 후원을 실시간으로 방송 화면에 전시합니다." },
  { key: "LUCKYBOX", emoji: "📦", color: "#ec4899", title: "럭키박스", description: "실시간 럭키박스 당첨 현황과 연출을 보여줍니다." },
  { key: "PLAY", emoji: "🎮", color: "#10b981", title: "플레이", description: "미니게임과 참여형 콘텐츠 화면 위젯입니다." },
  { key: "GACHA", emoji: "🧸", color: "#f97316", title: "뽑기 후원", description: "시청자와 함께 다양한 뽑기 이벤트를 진행합니다." },
  { key: "WALLPAPER", emoji: "🖼️", color: "#ef4444", title: "벽지", description: "후원 액션을 남길 수 있는 특수 배경 위젯입니다." }
];

/** URL path segment per widget (the design mixes /widget/ and /widgets/; one pattern is used). */
export const WIDGET_PATHS: Record<WidgetKey, string> = {
  CHAT: "chat",
  QR: "qr",
  GOAL: "goal",
  TOTAL: "total-donation",
  RECENT: "recent-alerts",
  EVENT: "event",
  MINI: "mini-donation",
  RANKING: "sponsor-ranking",
  CUSTOM_SOUND: "custom-sound",
  VOTE: "vote",
  QUEST: "quest",
  DRAWING: "drawing",
  LUCKYBOX: "luckybox",
  PLAY: "play",
  GACHA: "gacha",
  WALLPAPER: "wallpaper"
};

// ── Shared field types ───────────────────────────────────────────────────────

/** Fonts shown across the popups. The final list (and licensing) is TBD. */
export const FONT_FAMILIES = ["제주 고딕", "Pretendard", "나눔바른고딕", "맑은 고딕", "기본 시스템 폰트"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
export const FONT_SIZES = [12, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48] as const;

export type FontSetting = { family: FontFamily; size: number; color: string };

export const ALERT_EFFECTS_IN = ["Fade In", "Slide In", "Zoom In", "없음"] as const;
export const ALERT_EFFECTS_OUT = ["Fade Out", "Slide Out", "Zoom Out", "없음"] as const;

export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);

// ── Per-widget settings (PR 1: 채팅창 · QR · 후원목표 · 후원누적금액) ─────────────────

export const CHAT_STYLES = [
  { key: "LINE_PLAIN", label: "한 줄 테두리 없음" },
  { key: "LINE_BOX", label: "한 줄 상자 테두리" },
  { key: "BOX_ALIGNED", label: "상자 테두리 (정렬)" },
  { key: "BUBBLE", label: "말풍선형" },
  { key: "BOX_SIMPLE", label: "상자형 심플" }
] as const;
export const NICKNAME_BG = [
  { key: "ALWAYS", label: "항상 표시" },
  { key: "DARK_ONLY", label: "어두운 닉네임만" },
  { key: "NEVER", label: "표시 안 함" }
] as const;
export const CHAT_MAX_LINES = 20;
export const CHAT_MAX_FILTERS = 30;
export const NICKNAME_MAX = 20;

export type ChatSettings = {
  style: (typeof CHAT_STYLES)[number]["key"];
  effectIn: (typeof ALERT_EFFECTS_IN)[number];
  effectOut: (typeof ALERT_EFFECTS_OUT)[number];
  font: FontSetting;
  creatorNicknameColor: boolean;
  nicknameBackground: (typeof NICKNAME_BG)[number]["key"];
  maxLines: number;
  autoHide: boolean;
  hideAfterSec: number;
  hidePlatformIcon: boolean;
  filteredNicknames: string[];
};

export const QR_STYLES = [
  { key: "BASIC", label: "기본형" },
  { key: "ROUND", label: "라운드형" },
  { key: "CIRCLE", label: "원형" },
  { key: "SOFT", label: "부드러운형" }
] as const;
export const QR_CAPTION_MAX = 20;

export type QrSettings = {
  codeStyle: (typeof QR_STYLES)[number]["key"];
  borderColor: string;
  centerLogo: boolean;
  captionEnabled: boolean;
  caption: string;
  captionPosition: "TOP" | "BOTTOM";
  captionFont: { family: FontFamily; size: number };
};

export const GOAL_STYLES = [
  { key: "BASIC", label: "기본형" },
  { key: "ONE_LINE", label: "기본 한 줄" },
  { key: "SIMPLE", label: "심플 레이아웃" }
] as const;
export const GOAL_TITLE_MAX = 30;
/** Input guard only; the real ceiling is TBD. */
export const GOAL_AMOUNT_MAX = 1_000_000_000;

export type GoalSettings = {
  style: (typeof GOAL_STYLES)[number]["key"];
  title: string;
  startAmount: number;
  goalAmount: number;
  from: string;
  to: string;
  showPercent: boolean;
  barColor: string;
  barBackground: string;
  barHeight: number;
  textOutline: boolean;
  font: { family: FontFamily; size: number };
};

export const TOTAL_TITLE_MAX = 20;
export const TOTAL_TEMPLATE_MAX = 40;
export const TOTAL_TEMPLATE_TOKEN = "{total_amount}";

export type TotalSettings = {
  title: string;
  template: string;
  /** `YYYY-MM-DDTHH:mm` (local). */
  from: string;
  to: string;
  titleFont: FontSetting;
  contentFont: FontSetting;
  textOutline: boolean;
};

// ── PR 2: 최근알림 · 이벤트 · 미니후원 · 후원랭킹 · 투표 · 커스텀 사운드 ──────────────────

export const TEMPLATE_MAX = 60;

/** Alert text per confirmed platform (the design shows 치지직/아프리카). Event mapping per platform is TBD. */
export const RECENT_PLATFORMS = [
  { key: "YOUTUBE", label: "YouTube", color: "#ff0000" },
  { key: "FLEXTV", label: "FlexTV", color: "#f5bf0a" },
  { key: "SOOP", label: "SOOP", color: "#1e6bff" }
] as const;
export type RecentPlatform = (typeof RECENT_PLATFORMS)[number]["key"];
export const RECENT_EFFECTS = ["Fade In / Out", "Slide In / Out", "없음"] as const;
export const RECENT_SCROLL_SPEEDS = [0.3, 0.5, 1, 2] as const;

export type RecentSettings = {
  effect: (typeof RECENT_EFFECTS)[number];
  count: number;
  lineGap: number;
  scrollSpeedSec: (typeof RECENT_SCROLL_SPEEDS)[number];
  font: FontSetting;
  nicknameColor: boolean;
  textOutline: boolean;
  templates: Record<RecentPlatform, string>;
};

export const EVENT_STYLES = [
  { key: "BASIC", label: "기본형" },
  { key: "BOX", label: "박스형" },
  { key: "LIST", label: "리스트형" }
] as const;
export const EVENT_ORDERS = ["최신순", "오래된순"] as const;

export type EventSettings = {
  style: (typeof EVENT_STYLES)[number]["key"];
  order: (typeof EVENT_ORDERS)[number];
  effect: (typeof RECENT_EFFECTS)[number];
  font: FontSetting;
  nicknameColor: boolean;
  nicknameBackground: boolean;
  maxLines: number;
  autoHide: boolean;
  hideAfterSec: number;
};

export type MiniSettings = {
  style: "SCROLL" | "BUBBLE";
  direction: "RTL" | "LTR";
  /** 1 (slow) – 100 (fast). */
  speed: number;
  /** Where the text starts, 0–100 % of the widget width. */
  startPercent: number;
  showAmount: boolean;
  showNickname: boolean;
  /** Mini donations below this FN are not shown on the widget. */
  minAmount: number;
  font: FontSetting;
  textOutline: boolean;
};

export const RANKING_STYLES = [
  { key: "TEXT", label: "텍스트", image: "/mock/creator/widgets/ranking-style-1.png" },
  { key: "SCROLL_TEXT", label: "스크롤 되는 텍스트", image: "/mock/creator/widgets/ranking-style-2.png" },
  { key: "SIMPLE", label: "심플", image: "/mock/creator/widgets/ranking-style-3.png" },
  { key: "LINE_BOX", label: "한 줄 상자 테두리", image: "/mock/creator/widgets/ranking-style-4.png" }
] as const;
export const RANKING_NAME_TYPES = [
  { key: "ACCOUNT", label: "계정" },
  { key: "DONATION_NAME", label: "후원시 설정한 이름" }
] as const;
/** Periods offered for the widget ranking (design shows 월간 selected; the full list is TBD). */
export const RANKING_WIDGET_PERIODS = ["일간", "주간", "월간", "전체"] as const;
export const RANKING_SPEEDS = [
  { key: "VERY_SLOW", label: "매우 느리게" },
  { key: "SLOW", label: "느리게" },
  { key: "NORMAL", label: "보통" },
  { key: "FAST", label: "빠르게" },
  { key: "VERY_FAST", label: "매우 빠르게" }
] as const;
export const RANKING_MAX_RANKS = 10;

export type RankTierStyle = { font: FontSetting; accentColor: string };
export type RankingSettings = {
  style: (typeof RANKING_STYLES)[number]["key"];
  title: string;
  titleFont: FontSetting;
  nameType: (typeof RANKING_NAME_TYPES)[number]["key"];
  period: (typeof RANKING_WIDGET_PERIODS)[number];
  showAmount: boolean;
  ranks: number;
  /** `{rank}` · `{name}` · `{amount}` parts. */
  format: { rank: string; name: string; amount: string };
  scrollGap: number;
  scrollSpeed: (typeof RANKING_SPEEDS)[number]["key"];
  first: RankTierStyle;
  others: RankTierStyle;
};

export const VOTE_PRESET_MAX = 10;
export const VOTE_ITEMS_MIN = 2;
export const VOTE_ITEMS_MAX = 10;
export const VOTE_ITEM_MAX_CHARS = 10;
export const VOTE_NAME_MAX = 30;
/** Input guards only — vote pricing limits are TBD. */
export const VOTE_PRICE_MAX = 10_000_000;
export const VOTE_DURATION_MAX_SEC = 24 * 3600;
export const VOTE_COLORS = ["#28BA93", "#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#EAB308"] as const;

export type VotePreset = {
  id: string;
  name: string;
  color: string;
  durationSec: number;
  pricePerVote: number;
  freeVotes: number;
  items: string[];
};
export type VoteSettings = {
  enabled: boolean;
  titleFont: FontSetting;
  infoFont: FontSetting;
  itemFont: FontSetting;
  presets: VotePreset[];
};

export const CUSTOM_SOUND_MAX = 20;
export const CUSTOM_SOUND_WORD_MAX = 20;
/** Mock upload guard; the real size/format policy is TBD. */
export const CUSTOM_SOUND_MAX_BYTES = 2 * 1024 * 1024;
export const CUSTOM_SOUND_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"] as const;

export type CustomSound = { id: string; word: string; fileName: string; fileUrl: string; volume: number };
/** Saved per sound through saveCustomSound/deleteCustomSound, not through the popup footer. */
export type CustomSoundSettings = { sounds: CustomSound[] };

export type WidgetSettingsMap = {
  CHAT: ChatSettings;
  QR: QrSettings;
  GOAL: GoalSettings;
  TOTAL: TotalSettings;
  RECENT: RecentSettings;
  EVENT: EventSettings;
  MINI: MiniSettings;
  RANKING: RankingSettings;
  VOTE: VoteSettings;
  CUSTOM_SOUND: CustomSoundSettings;
};
export type EditableWidgetKey = keyof WidgetSettingsMap;
export const EDITABLE_WIDGETS: EditableWidgetKey[] = ["CHAT", "QR", "GOAL", "TOTAL", "RECENT", "EVENT", "MINI", "RANKING", "VOTE", "CUSTOM_SOUND"];
export const isEditableWidget = (k: unknown): k is EditableWidgetKey => EDITABLE_WIDGETS.includes(k as EditableWidgetKey);

/** Values the server reads for previews (not editable). */
export type WidgetLiveData = {
  /** FN donated within the goal period (GOAL preview). */
  goalCurrent: number;
  /** FN donated within the total period (TOTAL preview). */
  totalAmount: number;
  /** QR image (mock asset; the real QR is generated by the backend — TBD). */
  qrImageUrl: string;
  /** Top donors for the RANKING preview. */
  ranking: { name: string; amount: number }[];
  /** Lowest mini donation amount (MINI preview / guard). */
  miniMinAmount: number;
};

export type CustomSoundResult =
  | { status: "SAVED"; sound: CustomSound }
  | { status: "INVALID"; message: string }
  | { status: "UNAUTHORIZED" };

export type WidgetDetail<K extends EditableWidgetKey = EditableWidgetKey> = {
  key: K;
  url: string;
  settings: WidgetSettingsMap[K];
  live: WidgetLiveData;
};

export type WidgetSaveResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsMap = {
  CHAT: {
    style: "LINE_BOX",
    effectIn: "Fade In",
    effectOut: "Fade Out",
    font: { family: "제주 고딕", size: 24, color: "#FFFFFF" },
    creatorNicknameColor: true,
    nicknameBackground: "DARK_ONLY",
    maxLines: 8,
    autoHide: true,
    hideAfterSec: 15,
    hidePlatformIcon: false,
    filteredNicknames: ["Nightbot", "MooBot", "StreamElements"]
  },
  QR: {
    codeStyle: "BASIC",
    borderColor: "#519CFF",
    centerLogo: true,
    captionEnabled: true,
    caption: "후원 하기",
    captionPosition: "TOP",
    captionFont: { family: "Pretendard", size: 18 }
  },
  GOAL: {
    style: "BASIC",
    title: "캠방 장비 교체 가자!",
    startAmount: 0,
    goalAmount: 100_000,
    from: "2026-09-01",
    to: "2026-09-30",
    showPercent: true,
    barColor: "#519CFF",
    barBackground: "#FFFFFF",
    barHeight: 40,
    textOutline: true,
    font: { family: "Pretendard", size: 14 }
  },
  TOTAL: {
    title: "총 후원 금액",
    template: "{total_amount}FN",
    from: "2026-01-01T00:00",
    to: "2026-12-31T23:59",
    titleFont: { family: "제주 고딕", size: 24, color: "#FFFFFF" },
    contentFont: { family: "제주 고딕", size: 28, color: "#F5BF0A" },
    textOutline: true
  },
  RECENT: {
    effect: "Fade In / Out",
    count: 3,
    lineGap: 10,
    scrollSpeedSec: 0.5,
    font: { family: "나눔바른고딕", size: 14, color: "#FFFFFF" },
    nicknameColor: true,
    textOutline: false,
    templates: {
      YOUTUBE: "{nickname}님이 {amount} 후원했습니다.",
      FLEXTV: "{nickname}님이 {amount} 후원했습니다.",
      SOOP: "{nickname}님이 별풍선 {count}개를 후원했습니다."
    }
  },
  EVENT: {
    style: "BOX",
    order: "최신순",
    effect: "Slide In / Out",
    font: { family: "기본 시스템 폰트", size: 16, color: "#FFFFFF" },
    nicknameColor: true,
    nicknameBackground: true,
    maxLines: 8,
    autoHide: true,
    hideAfterSec: 15
  },
  MINI: {
    style: "SCROLL",
    direction: "RTL",
    speed: 30,
    startPercent: 0,
    showAmount: true,
    showNickname: true,
    // The design shows 1,000, which would hide every mini donation (they are under 1,000 FN); TBD.
    minAmount: 100,
    font: { family: "맑은 고딕", size: 15, color: "#FFFFFF" },
    textOutline: true
  },
  RANKING: {
    style: "SIMPLE",
    title: "후원랭킹",
    titleFont: { family: "제주 고딕", size: 24, color: "#000000" },
    nameType: "ACCOUNT",
    period: "월간",
    showAmount: true,
    ranks: 5,
    format: { rank: "{rank}등", name: "{name}", amount: "{amount}FN" },
    scrollGap: 10,
    scrollSpeed: "FAST",
    first: { font: { family: "제주 고딕", size: 24, color: "#FFFFFF" }, accentColor: "#FFFFFF" },
    others: { font: { family: "제주 고딕", size: 24, color: "#FFFFFF" }, accentColor: "#FFFFFF" }
  },
  VOTE: {
    enabled: true,
    titleFont: { family: "제주 고딕", size: 36, color: "#28BA93" },
    infoFont: { family: "제주 고딕", size: 24, color: "#000000" },
    itemFont: { family: "제주 고딕", size: 24, color: "#000000" },
    presets: [{ id: "preset-1", name: "", color: "#28BA93", durationSec: 300, pricePerVote: 1_000, freeVotes: 0, items: ["", ""] }]
  },
  CUSTOM_SOUND: { sounds: [] }
};
