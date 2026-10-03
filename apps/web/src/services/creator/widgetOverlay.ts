"use server";

import { USE_MOCK } from "@/lib/mock";
import { mockAlerts, overlaySignal } from "./alertCore";
import { mockCreator } from "./mockCreatorStore";
import { eventLines, goalProgress, rankingRows, recentLines, totalAmount } from "./widgetOverlayCore";
import { QR_SAMPLE_IMAGE, isWidgetOverlay, type OverlayWidget } from "./widgetOverlayTypes";
import { readWidget } from "./widgetStore";

/**
 * 후원 위젯 OBS overlays (code-first): no login — the integration key in the URL is the credential, like
 * the other overlays. Settings come from 위젯 settings, numbers from the creator's donation feed.
 */
export async function getOverlayWidget(widget: unknown, key: unknown): Promise<OverlayWidget | "FORBIDDEN"> {
  if (!USE_MOCK) throw new Error("Widget overlay API is not connected yet.");
  if (typeof key !== "string" || key !== mockCreator.integrationKey || !isWidgetOverlay(widget)) return "FORBIDDEN";
  // 리모컨 signals: 새로고침 (reloadSeq) and 기능 제어 ON/OFF (on), shared by every 후원 위젯.
  const common = { ...overlaySignal("widgets"), serverNow: new Date().toISOString() };
  const items = mockAlerts.items;
  switch (widget) {
    case "goal": {
      const settings = readWidget("GOAL");
      return { widget, settings, ...goalProgress(items, settings), ...common };
    }
    case "total": {
      const settings = readWidget("TOTAL");
      return { widget, settings, total: totalAmount(items, settings), ...common };
    }
    case "ranking": {
      const settings = readWidget("RANKING");
      return { widget, settings, rows: rankingRows(items, settings), ...common };
    }
    case "recent": {
      const settings = readWidget("RECENT");
      return { widget, settings, lines: recentLines(items, settings), ...common };
    }
    case "event": {
      const settings = readWidget("EVENT");
      return { widget, settings, lines: eventLines(items, settings), ...common };
    }
    case "qr":
      return { widget, settings: readWidget("QR"), imageUrl: QR_SAMPLE_IMAGE, ...common };
  }
}
