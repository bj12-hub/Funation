import { raisedGoal } from "@/services/creator/widgetOverlayCore";
import { baseAmount, excelOf, feedOf, windowGames, windowReceived } from "./crewCore";
import {
  DEFAULT_WINDOW_GAUGE,
  GAUGE_NUMBERS,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  WINDOW_GAUGE_BASES,
  WINDOW_GAUGE_GOAL_MAX,
  goalPercent,
  type WindowGaugeLive,
  type WindowGaugeSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시간 내 통합 게이지 (server-only) — code-first, StreamDonate 시간 내 통합 게이지 참고: one goal gauge for the whole crew
 * that counts only between 시작 and 정지, on 후원금 or 기여도 (see WindowGaugeBasis). Display numbers only.
 */

export const windowGaugeSettingsOf = (channelId: string): WindowGaugeSettings => mockCrew.windowGauges?.[channelId] ?? DEFAULT_WINDOW_GAUGE;

const isWhole = (v: unknown, min: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= WINDOW_GAUGE_GOAL_MAX;

export function parseWindowGauge(input: unknown, forbidden: string[]): WindowGaugeSettings | { message: string } {
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > PRIZE_TITLE_MAX) return { message: `제목은 ${PRIZE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (forbidden.some((w) => title.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  const basis = WINDOW_GAUGE_BASES.find((b) => b.key === v.basis)?.key;
  if (!basis) return { message: "집계 기준을 골라 주세요." };
  if (!isWhole(v.goal, 1)) return { message: `목표는 1 ~ ${WINDOW_GAUGE_GOAL_MAX.toLocaleString("ko-KR")}로 입력해 주세요.` };
  if (!isWhole(v.autoRaise, 0)) return { message: "자동 증량을 확인해 주세요." };
  const numbers = GAUGE_NUMBERS.find((n) => n.key === v.numbers)?.key;
  if (!numbers) return { message: "숫자 표시를 골라 주세요." };
  const placement = PRIZE_PLACEMENTS.find((p) => p.key === v.placement)?.key;
  if (!placement) return { message: "배치를 골라 주세요." };
  return { title, basis, goal: v.goal, autoRaise: v.autoRaise, numbers, placement };
}

/**
 * The gauge of a live broadcast over its 구간 (0 until 시작; frozen at 정지). AMOUNT adds every donation of the 구간 in the
 * 자동엑셀 score unit; POINTS adds the members' 구간 points (received + 점수 게임 — 강탈 nets out across the crew).
 */
export function windowGaugeLive(b: MockBroadcast): WindowGaugeLive {
  const settings = windowGaugeSettingsOf(b.channelId);
  const s = excelOf(b.channelId);
  const w = b.windowGauge?.window ?? null;
  let current = 0;
  let count = 0;
  if (w) {
    const end = w.stoppedAt ?? new Date(Date.now() + 1000).toISOString();
    const inWindow = (at: string) => at >= w.startedAt && at <= end;
    const attributions = mockCrew.attributions.filter((a) => a.channelId === b.channelId && inWindow(a.at));
    const feed = feedOf(b).filter((f) => f.status !== "CANCELLED" && inWindow(f.at));
    count = attributions.length + feed.length;
    if (settings.basis === "AMOUNT") {
      current = attributions.reduce((sum, a) => sum + (baseAmount(a.fnAmount, "FN", s) ?? 0), 0) + feed.reduce((sum, f) => sum + (baseAmount(f.amount, f.unit, s) ?? 0), 0);
      current = Math.round(current);
    } else {
      for (const p of windowReceived(b, w.startedAt, w.stoppedAt).values()) current += p;
      for (const p of windowGames(b, w.startedAt, w.stoppedAt).values()) current += p;
    }
  }
  const target = raisedGoal(settings.goal, current, settings.autoRaise);
  return {
    settings: structuredClone(settings),
    visible: !!b.windowGauge?.visible,
    window: w && { startedAt: w.startedAt, stoppedAt: w.stoppedAt },
    current,
    target,
    percent: goalPercent(current, target),
    unit: settings.basis === "POINTS" ? "점" : s.unit === "KRW" ? "원" : "FN",
    count
  };
}
