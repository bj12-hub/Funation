import { formatNumber } from "@/lib/format";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import type { AlertItem } from "./alertTypes";
import { WALL_SIZE, type WallSticker } from "./widgetOverlayTypes";
import type { WallpaperSettings } from "./widgetSettingsTypes";

/**
 * 벽지 위젯 (2026-10-04 결정: 자동 배치 스티커 벽). Every donation in the 후원 알림 feed after the last
 * 벽지 비우기 becomes a sticker — a 벽지 image with the nickname and amount, laid out with the 벽지 레이아웃 —
 * on a free spot of the 1920 × 1080 screen. The layout is computed on the server from the feed, so
 * every OBS reload shows the same wall. When all spots are taken the oldest sticker gives its spot up.
 * Server-only (not a "use server" module).
 */

const COLS = 8;
const ROWS = 3;
export const WALL_SLOTS = COLS * ROWS;
const CELL = { w: WALL_SIZE.w / COLS, h: WALL_SIZE.h / ROWS };

type Store = { clearedAt: Record<string, string> };
const g = globalThis as typeof globalThis & { __funationMockWallpaperV1?: Store };
/** A fresh wall starts when the mock starts (older feed items are not stuck on it). */
export const mockWallpaper = (g.__funationMockWallpaperV1 ??= { clearedAt: { [STUDIO_CHANNEL]: new Date().toISOString() } });

export const clearedAtOf = (channelId: string) => mockWallpaper.clearedAt[channelId] ?? null;

/** 32-bit string hash (FNV-1a), for deterministic layout. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Slot order for one wall (seeded by when it was cleared), so stickers spread over the screen. */
function slotOrder(seed: string) {
  const order = Array.from({ length: WALL_SLOTS }, (_, i) => i);
  let x = hash(seed) || 1;
  for (let i = order.length - 1; i > 0; i--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const j = (x >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const amountOf = (a: AlertItem) => a.amountLabel ?? `${formatNumber(a.fnAmount)} FN`;

/**
 * The stickers on the wall: feed donations after `clearedAt` (all kinds, 테스트 후원 included so the 리모컨
 * can try it; alerts the 리모컨 skipped or the 최소 금액 filter hid get none), the latest WALL_SLOTS of them.
 * The k-th sticker since the wall was cleared takes the k-th slot of the wall's shuffled order, so the
 * visible ones never overlap. 벽지 images rotate in order.
 */
export function wallStickers(items: AlertItem[], settings: Pick<WallpaperSettings, "images">, clearedAt: string | null): WallSticker[] {
  const since = clearedAt ? Date.parse(clearedAt) : 0;
  const all = items.filter((a) => Date.parse(a.createdAt) > since && a.status !== "SKIPPED" && a.status !== "FILTERED");
  const order = slotOrder(clearedAt ?? "wall");
  const start = Math.max(0, all.length - WALL_SLOTS);
  return all.slice(start).map((a, i) => {
    const k = start + i;
    const slot = order[k % WALL_SLOTS];
    const h = hash(a.id);
    const jitterX = (h % 41) - 20;
    const jitterY = ((h >>> 8) % 41) - 20;
    const image = settings.images.length ? k % settings.images.length : null;
    return {
      id: a.id,
      x: Math.round((slot % COLS) * CELL.w + 20 + jitterX),
      y: Math.round(Math.floor(slot / COLS) * CELL.h + 30 + jitterY),
      rotate: ((h >>> 16) % 13) - 6,
      image,
      nickname: a.donor,
      amount: amountOf(a),
      test: a.kind === "TEST"
    };
  });
}
