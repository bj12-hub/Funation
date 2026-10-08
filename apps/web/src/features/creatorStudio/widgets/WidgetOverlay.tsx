"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import type { OverlayWidget } from "@/services/creator/widgetOverlayTypes";
import { useReloadSignal } from "../remote/useReloadSignal";
import { ClockView } from "./ClockView";
import { GoalView } from "./GoalView";
import { GachaBoardView, GachaView, QuestView, RouletteView, VoteView, WallpaperView } from "./GameViews";
import { EventView, QrView, RankingView, RecentView, TotalView } from "./WidgetViews";

/**
 * 후원 위젯 OBS overlay (code-first). Transparent page that re-reads its widget every 2 seconds; the
 * 리모컨 기능 제어 "후원 위젯" switch hides every widget and 새로고침 reloads it.
 */
export function WidgetOverlay({ data }: { data: OverlayWidget }) {
  const router = useRouter();
  useReloadSignal(data.reloadSeq);

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), 2000);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);

  if (!data.on) return null;
  switch (data.widget) {
    case "goal":
      return <GoalView settings={data.settings} first={data} second={data.second} daysLeft={data.daysLeft} theme={data.theme} />;
    case "total":
      return <TotalView settings={data.settings} total={data.total} theme={data.theme} />;
    case "ranking":
      return <RankingView settings={data.settings} rows={data.rows} theme={data.theme} />;
    case "recent":
      return <RecentView settings={data.settings} lines={data.lines} theme={data.theme} />;
    case "event":
      return <EventOverlay data={data} />;
    case "qr":
      return <QrView settings={data.settings} imageUrl={data.imageUrl} theme={data.theme} />;
    case "quest":
      return <Clocked data={data} />;
    case "vote":
      return <Clocked data={data} />;
    case "roulette":
      return <RouletteView stage={data.stage} theme={data.theme} />;
    case "gacha":
      return <GachaView stage={data.stage} history={data.history} theme={data.theme} />;
    case "gacha-board":
      return <GachaBoardView board={data.board} theme={data.theme} />;
    case "clock":
      return <Clock data={data} />;
    case "wallpaper":
      return <WallpaperView settings={data.settings} images={data.images} stickers={data.stickers} theme={data.theme} />;
  }
}

/** 이벤트: lines older than 자동 숨김 seconds leave on the server clock (corrected for skew). */
function EventOverlay({ data }: { data: Extract<OverlayWidget, { widget: "event" }> }) {
  const now = useServerClock(data.serverNow);
  return <EventView settings={data.settings} lines={data.lines} theme={data.theme} now={now} />;
}

/** 퀘스트 · 투표 count down on the server clock (corrected for skew). */
function Clocked({ data }: { data: Extract<OverlayWidget, { widget: "quest" | "vote" }> }) {
  const now = useServerClock(data.serverNow);
  return data.widget === "quest" ? (
    <QuestView settings={data.settings} quests={data.quests} theme={data.theme} now={now} />
  ) : (
    <VoteView settings={data.settings} vote={data.vote} theme={data.theme} now={now} />
  );
}

/** 시계: ticks every second on the server clock (corrected for skew). */
function Clock({ data }: { data: Extract<OverlayWidget, { widget: "clock" }> }) {
  const now = useServerClock(data.serverNow);
  return <ClockView settings={data.settings} now={now} theme={data.theme} />;
}
