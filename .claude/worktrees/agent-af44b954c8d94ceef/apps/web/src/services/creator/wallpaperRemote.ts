"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { mockAlerts } from "./alertCore";
import type { RemoteResult } from "./alertTypes";
import { WALL_SLOTS, clearedAtOf, mockWallpaper, wallStickers } from "./wallpaperCore";
import { readWidget } from "./widgetStore";

/** 리모컨 벽지 (2026-10-04 결정: 자동 배치 스티커 벽): how full the wall is, and 벽지 비우기. */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Wallpaper remote API is not connected yet.");
};

export type WallpaperRemoteView = { stickers: number; slots: number; clearedAt: string | null };

export async function getWallpaperRemote(): Promise<WallpaperRemoteView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const clearedAt = clearedAtOf(STUDIO_CHANNEL);
  return { stickers: wallStickers(mockAlerts.items, readWidget("WALLPAPER"), clearedAt).length, slots: WALL_SLOTS, clearedAt };
}

/** 벽지 비우기: the wall starts over from now (the donations stay in the feed and the 후원 내역). */
export async function clearWallpaper(): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  mockWallpaper.clearedAt = { ...mockWallpaper.clearedAt, [STUDIO_CHANNEL]: new Date().toISOString() };
  return { status: "SAVED" };
}
