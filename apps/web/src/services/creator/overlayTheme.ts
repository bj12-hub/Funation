"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { readAppearance, writeAppearance } from "./overlayThemeStore";
import { isHex6, isOverlayTheme, type OverlayAppearance } from "./overlayThemeTypes";
import type { WidgetSaveResult } from "./widgetSettingsTypes";

/**
 * 오버레이 테마 Server Actions — code-first (route `/creator/widgets`, "오버레이 테마" section). The overlays read
 * the same store without a login (./overlayThemeStore.ts), like their other settings.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Overlay theme API is not connected yet.");
};

export async function getOverlayAppearance(): Promise<OverlayAppearance | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return readAppearance();
}

export async function saveOverlayAppearance(input: unknown): Promise<WidgetSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isOverlayTheme(v.theme)) return { status: "INVALID", message: "테마를 골라 주세요." };
  if (v.accent !== null && !isHex6(v.accent)) return { status: "INVALID", message: "포인트 색상은 #RRGGBB 형식으로 입력해 주세요." };
  await mockDelay(300);
  writeAppearance({ theme: v.theme, accent: v.accent === null ? null : (v.accent as string).toUpperCase() });
  return { status: "SAVED" };
}
