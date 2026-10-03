import { formatNumber } from "@/lib/format";
import type { AlertItem } from "./alertTypes";
import type { WidgetFeedLine, WidgetRankRow } from "./widgetOverlayTypes";
import {
  RECENT_PLATFORMS,
  TOTAL_TEMPLATE_TOKEN,
  type EventSettings,
  type GoalSettings,
  type RankingSettings,
  type RecentSettings,
  type TotalSettings
} from "./widgetSettingsTypes";

/**
 * 후원 위젯 numbers from the creator's donation feed (the 후원 알림 history). Pure functions, shared by
 * the overlay service and its tests.
 *
 * 목표 · 누적 · 랭킹 count completed Somnation donations only: 테스트 후원 never counts, and platform
 * donations (후원 연동) have no FN rate yet (TBD). An alert hidden by the 최소 금액 filter still counts.
 */
export const countedDonations = (items: AlertItem[]) => items.filter((a) => a.kind === "DONATION");

function sumBetween(items: AlertItem[], from: number, to: number) {
  return countedDonations(items)
    .filter((a) => {
      const t = Date.parse(a.createdAt);
      return t >= from && t <= to;
    })
    .reduce((sum, a) => sum + a.fnAmount, 0);
}

const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`).getTime();

/** 후원목표: 시작 금액 + donations in the 산정 기간 (local days, inclusive). */
export function goalProgress(items: AlertItem[], s: GoalSettings, now = Date.now()) {
  const current = s.startAmount + sumBetween(items, dayStart(s.from), dayEnd(s.to));
  const percent = s.goalAmount > 0 ? Math.min(100, (current / s.goalAmount) * 100) : 0;
  const end = dayEnd(s.to);
  const daysLeft = Number.isNaN(end) ? null : Math.max(0, Math.ceil((end - now) / 86_400_000));
  return { current, percent: Math.round(percent * 10) / 10, daysLeft };
}

/** 후원누적금액: donations between `from` and `to` (`YYYY-MM-DDTHH:mm`, local; the `to` minute is included). */
export const totalAmount = (items: AlertItem[], s: TotalSettings) => sumBetween(items, new Date(s.from).getTime(), new Date(s.to).getTime() + 59_999);

export const fillTotal = (template: string, total: number) => template.split(TOTAL_TEMPLATE_TOKEN).join(formatNumber(total));

/** Start of a 후원랭킹 period in local calendar time: today, this week from Monday, this month; 전체 = no limit. */
export function rankingSince(period: RankingSettings["period"], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "일간":
      return today.getTime();
    case "주간":
      today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return today.getTime();
    case "월간":
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    default:
      return 0;
  }
}

/**
 * Top donors by FN in the period, ties broken by who donated first. A hidden profile (익명) is left out
 * (TBD: final rule). The feed keeps the name shown on the alert, so 계정 / 후원시 설정한 이름 both use it (TBD).
 */
export function rankingRows(items: AlertItem[], s: RankingSettings, now = new Date()): WidgetRankRow[] {
  const since = rankingSince(s.period, now);
  const totals = new Map<string, { fn: number; first: number }>();
  for (const a of countedDonations(items)) {
    const t = Date.parse(a.createdAt);
    if (t < since || a.donor === "익명") continue;
    const cur = totals.get(a.donor) ?? { fn: 0, first: t };
    cur.fn += a.fnAmount;
    totals.set(a.donor, cur);
  }
  return [...totals]
    .sort((x, y) => y[1].fn - x[1].fn || x[1].first - y[1].first)
    .slice(0, s.ranks)
    .map(([name, v], i) => ({ rank: i + 1, name, fnAmount: v.fn }));
}

/** `{rank}` · `{name}` · `{amount}` in a 후원랭킹 format part. */
export const fillRank = (t: string, rank: number, name: string, amount: number) =>
  t.replaceAll("{rank}", String(rank)).replaceAll("{name}", name).replaceAll("{amount}", formatNumber(amount));

const DEFAULT_LINE = "{nickname}님이 {amount} 후원했습니다.";
const EVENT_LINE = "{nickname}님이 {amount} 후원!";
const amountOf = (a: AlertItem) => a.amountLabel ?? `${formatNumber(a.fnAmount)} FN`;

function line(a: AlertItem, template: string): WidgetFeedLine {
  const amount = amountOf(a);
  const [before, ...after] = template.replaceAll("{amount}", amount).split("{nickname}");
  return { id: a.id, kind: a.kind, at: a.createdAt, nickname: a.donor, platform: a.platform ?? null, amount, before, after: after.join(a.donor) };
}

/**
 * 최근알림: the latest `count` donations, newest first. Platform donations use that platform's template;
 * Somnation donations use the default line, and so does a template asking for `{count}` (the platform's
 * item count is not mapped yet — TBD). 테스트 후원 shows so the remote can try it.
 */
export function recentLines(items: AlertItem[], s: RecentSettings): WidgetFeedLine[] {
  return items
    .slice(-Math.max(1, s.count))
    .reverse()
    .map((a) => {
      const own = RECENT_PLATFORMS.find((p) => p.key === a.platform);
      const template = a.kind === "EXTERNAL" && own && !s.templates[own.key].includes("{count}") ? s.templates[own.key] : DEFAULT_LINE;
      return line(a, template);
    });
}

/** 이벤트: the latest `maxLines` donations in the chosen order. */
export function eventLines(items: AlertItem[], s: EventSettings): WidgetFeedLine[] {
  const latest = items.slice(-Math.max(1, s.maxLines)).map((a) => line(a, EVENT_LINE));
  return s.order === "최신순" ? latest.reverse() : latest;
}
