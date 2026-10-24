import { OVERLAYS } from "./overlayCatalog";
import {
  LAYOUT_CANVASES,
  LAYOUT_ITEMS_MAX,
  LAYOUT_POS_LIMIT,
  LAYOUT_SCALE_MAX,
  LAYOUT_SCALE_MIN,
  LAYOUT_SIZE_MAX,
  LAYOUT_SIZE_MIN,
  type CanvasLayout,
  type LayoutCanvas,
  type LayoutItem,
  type OneSourceView
} from "./overlayLayoutTypes";

/**
 * 원소스 오버레이 배치 (server-only) — code-first. A layout per canvas, replaced whole on save. `revision` guards against
 * saving over a newer layout from another tab; `requestId` makes a retried save count once.
 */

type StoredCanvas = CanvasLayout & { lastRequestId: string | null };
type LayoutStore = Record<LayoutCanvas, StoredCanvas>;

const g = globalThis as typeof globalThis & { __ssumnationMockOverlayLayoutV1?: LayoutStore };
export const layoutStore = (): LayoutStore =>
  (g.__ssumnationMockOverlayLayoutV1 ??= Object.fromEntries(LAYOUT_CANVASES.map((c): [LayoutCanvas, StoredCanvas] => [c.key, { items: [], revision: 0, updatedAt: null, lastRequestId: null }])) as LayoutStore);

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const validItemId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{4,40}$/.test(v);

/** The items as sent from the editor, checked and normalized (스케일 to 0.01). */
export function parseLayoutItems(input: unknown): LayoutItem[] | { message: string } {
  if (!Array.isArray(input)) return { message: "배치 값을 확인해 주세요." };
  if (input.length > LAYOUT_ITEMS_MAX) return { message: `한 캔버스에 오버레이는 ${LAYOUT_ITEMS_MAX}개까지 놓을 수 있어요.` };
  const items: LayoutItem[] = [];
  for (const raw of input) {
    const v = rec(raw);
    if (!validItemId(v.id) || items.some((i) => i.id === v.id)) return { message: "배치 값을 확인해 주세요." };
    if (typeof v.overlayId !== "string" || !OVERLAYS.some((o) => o.id === v.overlayId)) return { message: "없는 오버레이가 있어요. 화면을 새로 고쳐 주세요." };
    if (!isInt(v.x, -LAYOUT_POS_LIMIT, LAYOUT_POS_LIMIT) || !isInt(v.y, -LAYOUT_POS_LIMIT, LAYOUT_POS_LIMIT)) return { message: `위치는 -${LAYOUT_POS_LIMIT} ~ ${LAYOUT_POS_LIMIT}px 안의 정수로 넣어 주세요.` };
    if (!isInt(v.width, LAYOUT_SIZE_MIN, LAYOUT_SIZE_MAX) || !isInt(v.height, LAYOUT_SIZE_MIN, LAYOUT_SIZE_MAX)) return { message: `가로 · 세로는 ${LAYOUT_SIZE_MIN} ~ ${LAYOUT_SIZE_MAX}px 정수로 넣어 주세요.` };
    if (typeof v.scale !== "number" || !Number.isFinite(v.scale) || v.scale < LAYOUT_SCALE_MIN || v.scale > LAYOUT_SCALE_MAX)
      return { message: `스케일은 ${LAYOUT_SCALE_MIN * 100} ~ ${LAYOUT_SCALE_MAX * 100}%예요.` };
    if (typeof v.hidden !== "boolean") return { message: "배치 값을 확인해 주세요." };
    items.push({ id: v.id, overlayId: v.overlayId, x: v.x, y: v.y, width: v.width, height: v.height, scale: Math.round(v.scale * 100) / 100, hidden: v.hidden });
  }
  return items;
}

/** Saves `canvas` when `revision` is still the saved one. Returns the new revision, or why not. */
export function saveCanvasLayout(input: { canvas: LayoutCanvas; items: LayoutItem[]; revision: number; requestId: string }, now = Date.now()): { revision: number } | { conflict: true } {
  const c = layoutStore()[input.canvas];
  if (c.lastRequestId === input.requestId) return { revision: c.revision };
  if (c.revision !== input.revision) return { conflict: true };
  c.items = input.items.map((i) => ({ ...i }));
  c.revision += 1;
  c.updatedAt = new Date(now).toISOString();
  c.lastRequestId = input.requestId;
  return { revision: c.revision };
}

/** A canvas's layout as the editor reads it. */
export const canvasLayout = (canvas: LayoutCanvas): CanvasLayout => {
  const c = layoutStore()[canvas];
  return { items: c.items.map((i) => ({ ...i })), revision: c.revision, updatedAt: c.updatedAt };
};

/** The 원소스 page for `canvas`: shown overlays only, each with its address under `key`. */
export function oneSource(canvas: LayoutCanvas, key: string): OneSourceView {
  const info = LAYOUT_CANVASES.find((c) => c.key === canvas)!;
  const c = layoutStore()[canvas];
  const items = c.items.flatMap((i) => {
    const o = OVERLAYS.find((x) => x.id === i.overlayId);
    return o && !i.hidden ? [{ ...i, src: o.path(key), title: o.title }] : [];
  });
  return { canvas, width: info.width, height: info.height, revision: c.revision, items };
}
