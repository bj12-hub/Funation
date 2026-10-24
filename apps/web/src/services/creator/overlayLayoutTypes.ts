/**
 * 원소스 오버레이 배치 — code-first, StreamDonate "오버레이 설정 (원소스)" 참고 (P3). One OBS browser source shows many
 * overlays: per 캔버스 (PC 16:9 · 모바일 가로 · 세로 9:16) the creator places overlays from the 오버레이 주소 catalog, each with
 * its browser-source size (가로 · 세로), position and 스케일, in a layer order (first = bottom). Each overlay keeps its own
 * settings, theme and 리모컨 ON/OFF; this only arranges them.
 */

export type LayoutCanvas = "PC" | "LANDSCAPE" | "PORTRAIT";
export const LAYOUT_CANVASES: { key: LayoutCanvas; label: string; query: string; width: number; height: number }[] = [
  { key: "PC", label: "PC 16:9", query: "pc", width: 1920, height: 1080 },
  { key: "LANDSCAPE", label: "모바일 가로", query: "landscape", width: 1280, height: 720 },
  { key: "PORTRAIT", label: "세로 9:16", query: "portrait", width: 1080, height: 1920 }
];
/** The canvas a `?canvas=` value names (PC when it names none). */
export const canvasByQuery = (query: unknown) => LAYOUT_CANVASES.find((c) => c.query === query) ?? LAYOUT_CANVASES[0];
export const canvasInfo = (key: LayoutCanvas) => LAYOUT_CANVASES.find((c) => c.key === key)!;

export const LAYOUT_ITEMS_MAX = 20;
/** A source's 가로 · 세로 (before 스케일), px. */
export const LAYOUT_SIZE_MIN = 40;
export const LAYOUT_SIZE_MAX = 3840;
export const LAYOUT_SCALE_MIN = 0.1;
export const LAYOUT_SCALE_MAX = 4;
/** How far a source's top-left may sit from the canvas origin, either way (px) — partly off the canvas is allowed. */
export const LAYOUT_POS_LIMIT = 3840;

/** A placed overlay: `x` · `y` its top-left on the canvas, `width` × `height` its browser-source size, drawn at `scale`. */
export type LayoutItem = { id: string; overlayId: string; x: number; y: number; width: number; height: number; scale: number; hidden: boolean };
export type CanvasLayout = { items: LayoutItem[]; revision: number; updatedAt: string | null };

/** The editor: every canvas's layout, and the key the live preview and the 원소스 address need (creator only). */
export type OverlayLayoutView = { canvases: Record<LayoutCanvas, CanvasLayout>; overlayKey: string };
/** CONFLICT: the canvas was saved elsewhere since this draft was loaded. */
export type LayoutResult = { status: "SAVED"; revision: number } | { status: "CONFLICT"; message: string } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** The 원소스 page (OBS): the canvas and its shown overlays, bottom first, each with its overlay address. */
export type OneSourceView = { canvas: LayoutCanvas; width: number; height: number; revision: number; items: (LayoutItem & { src: string; title: string })[] };

/** "800 × 600" → [800, 600] — the catalog's recommended browser-source size. */
export function catalogSize(size: string): [number, number] {
  const m = size.match(/(\d+)\s*×\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [1920, 1080];
}

/** A new overlay on `canvas` at its recommended size, centred, scaled down to fit when it is larger (stays at 100% otherwise). */
export function placeNew(id: string, overlayId: string, [width, height]: [number, number], canvas: LayoutCanvas): LayoutItem {
  const c = canvasInfo(canvas);
  const scale = Math.max(LAYOUT_SCALE_MIN, Math.floor(Math.min(1, c.width / width, c.height / height) * 100) / 100);
  return { id, overlayId, x: Math.round((c.width - width * scale) / 2), y: Math.round((c.height - height * scale) / 2), width, height, scale, hidden: false };
}
