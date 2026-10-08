/**
 * 오버레이 테마 — code-first (no Figma frame; 2026-10-08 결정 after the legacy FlexTV 도우미 review).
 * Every OBS overlay is drawn in one of three looks, chosen once for the channel (전체 테마) and optionally per
 * widget. Client-safe types and helpers only; the store and actions live in ./overlayTheme.ts.
 */

export const OVERLAY_THEMES = [
  { key: "BOLD", label: "볼드 플랫", summary: "굵은 외곽선 · 원색 블록 · 큰 숫자", mood: "엑셀방송처럼 텐션 높은 방송" },
  { key: "PILL", label: "미니멀 필", summary: "알약 모양 카드 · 절제된 숫자", mood: "어떤 방송 화면에도 무난하게" },
  { key: "GLASS", label: "소프트 글래스", summary: "반투명 카드 · 큰 라운드 · 파스텔", mood: "개인방송의 부드러운 감성" }
] as const;
export type OverlayTheme = (typeof OVERLAY_THEMES)[number]["key"];
export const isOverlayTheme = (v: unknown): v is OverlayTheme => OVERLAY_THEMES.some((t) => t.key === v);

/** A widget's own choice: one of the themes, or "INHERIT" = the channel's 전체 테마. */
export type OverlayThemeChoice = OverlayTheme | "INHERIT";
export const OVERLAY_THEME_CHOICES: readonly { key: OverlayThemeChoice; label: string }[] = [
  { key: "INHERIT", label: "전체 테마 따르기" },
  ...OVERLAY_THEMES.map((t) => ({ key: t.key, label: t.label }))
];
export const isOverlayThemeChoice = (v: unknown): v is OverlayThemeChoice => v === "INHERIT" || isOverlayTheme(v);

/**
 * Overlays managed outside the 위젯 page, each with its own theme choice (2026-10-08): 크루 점수판 (all crew views),
 * 영상 후원, 그림후원. 방송 도구 keep theirs in broadcastTools.
 */
export const LOOK_TARGETS = [
  { key: "crew", label: "크루 점수판" },
  { key: "video", label: "영상 후원" },
  { key: "drawing", label: "그림후원" }
] as const;
export type LookTarget = (typeof LOOK_TARGETS)[number]["key"];
export const isLookTarget = (v: unknown): v is LookTarget => LOOK_TARGETS.some((t) => t.key === v);

/** The accent each theme uses until the creator picks a 포인트 색상. */
export const THEME_DEFAULT_ACCENT: Record<OverlayTheme, string> = { BOLD: "#FFD23F", PILL: "#8B5CF6", GLASS: "#FFC6DD" };

/** Swatches offered next to the custom color input. */
export const ACCENT_PRESETS = ["#8B5CF6", "#EC4899", "#FFD23F", "#22C55E", "#0EA5E9", "#F97316", "#FFC6DD", "#FFFFFF"] as const;

/** The channel's 전체 테마. `accent` null = the theme's own color. */
export type OverlayAppearance = { theme: OverlayTheme; accent: string | null };
export const DEFAULT_OVERLAY_APPEARANCE: OverlayAppearance = { theme: "PILL", accent: null };

/** What an overlay draws with: the theme after 전체 테마 따르기 and the accent with a readable text color on it. */
export type ResolvedTheme = { theme: OverlayTheme; accent: string; accentInk: string };

export const isHex6 = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);

/**
 * Text color on an accent block: white while it keeps 3:1 (WCAG for the large bold text overlays use — so the brand
 * purple and pink keep white text), otherwise near-black #111111 (yellow, mint, pastels).
 */
export function readableInk(hex: string): string {
  if (!isHex6(hex)) return "#FFFFFF";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (lum + 0.05) >= 3 ? "#FFFFFF" : "#111111";
}

export function resolveTheme(appearance: OverlayAppearance, choice?: OverlayThemeChoice | null): ResolvedTheme {
  const theme = choice && choice !== "INHERIT" ? choice : appearance.theme;
  const accent = appearance.accent ?? THEME_DEFAULT_ACCENT[theme];
  return { theme, accent, accentInk: readableInk(accent) };
}

/** 등장 효과 for the redesigned overlays (`data-motion` in overlayTheme.module.css). */
export const OVERLAY_MOTIONS = [
  { key: "POP", label: "톡 튀어오르기" },
  { key: "SLIDE_UP", label: "아래에서 올라오기" },
  { key: "SLIDE_SIDE", label: "옆에서 밀려오기" },
  { key: "FADE", label: "스르륵 나타나기" },
  { key: "ZOOM", label: "쿵 내려앉기" },
  { key: "NONE", label: "효과 없음" }
] as const;
export type OverlayMotion = (typeof OVERLAY_MOTIONS)[number]["key"];
export const isOverlayMotion = (v: unknown): v is OverlayMotion => OVERLAY_MOTIONS.some((m) => m.key === v);

/**
 * 등장 효과 in Korean for the older selects. The values are the ones settings already store (English, from the Figma popups), so saved
 * settings keep working; only the words on screen change.
 */
export const EFFECT_LABELS: Record<string, string> = {
  "Fade In": "스르륵 나타나기",
  "Slide In": "옆에서 밀려오기",
  "Zoom In": "커지며 나타나기",
  "Fade Out": "스르륵 사라지기",
  "Slide Out": "옆으로 밀려나기",
  "Zoom Out": "작아지며 사라지기",
  "Fade In / Out": "스르륵 나타났다 사라지기",
  "Slide In / Out": "밀려왔다 밀려나기",
  없음: "효과 없음"
};
export const effectLabel = (v: string) => EFFECT_LABELS[v] ?? v;

/** The older In/Out effect values drawn with the theme motions: Fade → 스르륵, Slide → 옆에서, Zoom → 톡 (grows in). */
export const motionForEffect = (effect: string): OverlayMotion =>
  effect.startsWith("Fade") ? "FADE" : effect.startsWith("Slide") ? "SLIDE_SIDE" : effect.startsWith("Zoom") ? "POP" : "NONE";
export type LeaveMotion = "FADE" | "SLIDE" | "ZOOM" | "NONE";
export const leaveForEffect = (effect: string): LeaveMotion =>
  effect.startsWith("Fade") ? "FADE" : effect.startsWith("Slide") ? "SLIDE" : effect.startsWith("Zoom") ? "ZOOM" : "NONE";

/** Nickname colors for 크리에이터 지정 고유 컬러 (one per name, readable on dark and glass cards). */
export const NAME_PALETTE = ["#A78BFA", "#60A5FA", "#34D399", "#FBBF24", "#F472B6", "#22D3EE", "#FB923C", "#C4B5FD"] as const;
export function nameColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return NAME_PALETTE[h % NAME_PALETTE.length];
}
