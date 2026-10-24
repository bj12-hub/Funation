"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { mockCreator } from "./mockCreatorStore";
import { canvasLayout, oneSource, parseLayoutItems, saveCanvasLayout } from "./overlayLayoutCore";
import { LAYOUT_CANVASES, canvasByQuery, type LayoutResult, type OneSourceView, type OverlayLayoutView } from "./overlayLayoutTypes";

/**
 * 원소스 오버레이 배치 Server Actions — code-first (no Figma frame; StreamDonate "오버레이 설정 (원소스)" 참고, P3). Editor
 * route `/creator/widgets/layout` (creator session), OBS `/overlay/onesource/[key]?canvas=pc|landscape|portrait`
 * (integration key). Arranging only: no overlay settings, FN or points change here.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Overlay layout API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);

export async function getOverlayLayoutView(): Promise<OverlayLayoutView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return {
    canvases: Object.fromEntries(LAYOUT_CANVASES.map((c) => [c.key, canvasLayout(c.key)])) as OverlayLayoutView["canvases"],
    overlayKey: mockCreator.integrationKey
  };
}

/** Replaces one canvas's layout. `revision`: the one the draft was loaded at; `requestId`: a retried save counts once. */
export async function saveOverlayLayout(input: unknown): Promise<LayoutResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const canvas = LAYOUT_CANVASES.find((c) => c.key === v.canvas)?.key;
  if (!canvas || !validId(v.requestId) || typeof v.revision !== "number" || !Number.isInteger(v.revision)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const items = parseLayoutItems(v.items);
  if ("message" in items) return { status: "INVALID", message: items.message };
  const res = saveCanvasLayout({ canvas, items, revision: v.revision, requestId: v.requestId });
  return "conflict" in res ? { status: "CONFLICT", message: "다른 곳에서 이 캔버스를 먼저 저장했어요. 최신 배치를 불러온 뒤 다시 저장해 주세요." } : { status: "SAVED", revision: res.revision };
}

/** OBS read — no login; the integration key is the secret. `canvas`: the `?canvas=` value (PC when unknown). */
export async function getOneSource(key: unknown, canvas: unknown): Promise<OneSourceView | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key) || typeof key !== "string") return "FORBIDDEN";
  return oneSource(canvasByQuery(canvas).key, key);
}
