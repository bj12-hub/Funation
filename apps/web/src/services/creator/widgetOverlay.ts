"use server";

import { USE_MOCK } from "@/lib/mock";
import { mockAlerts, overlaySignal } from "./alertCore";
import { mockCreator } from "./mockCreatorStore";
import { mockQuests } from "@/services/donations/questCore";
import { currentRun, voteBoard } from "@/services/votes/voteCore";
import { stageOf } from "@/services/donations/rouletteCore";
import { boardOf, channelRows as gachaRows, stageOf as gachaStageOf } from "@/services/donations/gachaCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
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
    case "quest": {
      // Running quests of this channel, oldest first, up to 최대 개수. Past its time limit a quest stays
      // here until someone decides (2026-10-04 결정).
      const settings = readWidget("QUEST");
      const quests = mockQuests.items
        .filter((q) => q.channelId === STUDIO_CHANNEL && q.status === "IN_PROGRESS")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, settings.maxCount)
        .map((q) => ({ id: q.id, title: q.title, amount: q.amount, endsAt: new Date(Date.parse(q.createdAt) + q.timeLimitSec * 1000).toISOString() }));
      return { widget, settings, quests, ...common };
    }
    case "vote": {
      // The studio channel's vote from the 리모컨 (running, or ended until 결과 내리기).
      const run = currentRun(STUDIO_CHANNEL);
      return { widget, settings: readWidget("VOTE"), vote: run ? voteBoard(run) : null, ...common };
    }
    case "roulette":
      // The studio channel's wheel: spinning, or the result for a few seconds (펀페이 1009:199 · 1009:181).
      return { widget, settings: readWidget("ROULETTE"), stage: stageOf(STUDIO_CHANNEL), ...common };
    case "gacha": {
      // The studio channel's draws, one at a time (기계 회전 시간, then the result for 화면 노출 시간).
      const settings = readWidget("GACHA");
      const stage = gachaStageOf(STUDIO_CHANNEL);
      const history = gachaRows(STUDIO_CHANNEL)
        .recent.filter((r) => r.prize !== null && !r.blank)
        .slice(0, settings.credit.historyCount)
        .map((r) => ({ donor: r.donor, prize: r.prize as string }));
      return { widget, settings, stage, history, ...common };
    }
    case "gacha-board":
      return { widget, settings: readWidget("GACHA"), board: boardOf(STUDIO_CHANNEL), ...common };
  }
}
