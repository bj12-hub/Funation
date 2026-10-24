/**
 * AI 배너 — code-first, StreamDonate "배너 제작 (AI 이미지 생성: 스타일 6종 · 비율 · 화질)" 참고 (P3). Client-safe. The AI
 * provider is TBD: until then a mock provider draws sample banners (SVG) from the same request — the description's
 * keywords pick a motif, the style a look, the texts go on as typed. The creator picks one; the browser turns it into a
 * PNG and saves it to the 이미지·사운드 library, where the 배너 slideshow can use it.
 */

export const AI_PROMPT_MAX = 200;
export const AI_HEADLINE_MAX = 24;
export const AI_SUBLINE_MAX = 40;
/** Images per request. */
export const AI_BANNER_COUNT = 4;

export type AiStyle = "NEON" | "PASTEL" | "RETRO" | "MINIMAL" | "COMIC" | "SPACE";
export const AI_STYLES: { key: AiStyle; label: string; emoji: string }[] = [
  { key: "NEON", label: "네온", emoji: "💡" },
  { key: "PASTEL", label: "파스텔", emoji: "🍬" },
  { key: "RETRO", label: "레트로", emoji: "📼" },
  { key: "MINIMAL", label: "미니멀", emoji: "◻️" },
  { key: "COMIC", label: "코믹", emoji: "💥" },
  { key: "SPACE", label: "우주", emoji: "🪐" }
];

export type AiRatio = "WIDE" | "STRIP" | "SQUARE" | "TALL";
export const AI_RATIOS: { key: AiRatio; label: string; width: number; height: number }[] = [
  { key: "WIDE", label: "16:9", width: 1920, height: 1080 },
  { key: "STRIP", label: "4:1 띠", width: 1600, height: 400 },
  { key: "SQUARE", label: "1:1", width: 1080, height: 1080 },
  { key: "TALL", label: "9:16 세로", width: 1080, height: 1920 }
];

/** 화질: how large the saved PNG is (× the ratio's size). */
export type AiQuality = "STANDARD" | "HIGH";
export const AI_QUALITIES: { key: AiQuality; label: string; scale: number }[] = [
  { key: "STANDARD", label: "표준", scale: 0.6 },
  { key: "HIGH", label: "고화질", scale: 1 }
];

export type AiBannerRequest = { prompt: string; headline: string; subline: string; style: AiStyle; ratio: AiRatio; quality: AiQuality; seed: number };
/** One result: an image the browser can show and turn into a PNG of `width` × `height`. */
export type AiBannerImage = { id: string; svg: string; width: number; height: number };
export type AiBannerResult = { status: "OK"; provider: "MOCK"; images: AiBannerImage[] } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
