import { formatNumber } from "@/lib/format";
import { formatUnitAmount, isCurrencyUnit, unitLabel, type AmountUnit } from "@/types/donationUnit";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { HIDDEN_PROFILE_LABEL } from "@/services/supporter/identityTypes";
import { nativeAmount, type AlertItem } from "./alertTypes";
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
 * A 퀘스트 후원 counts only once it succeeded (held until then, refunded on 실패 · 취소 — 2026-10-04 결정), at the
 * time its alert went out.
 */
const counts = (a: AlertItem) => a.kind === "DONATION" && !a.replayOf && (a.questId === undefined || a.questSucceeded === true);
/** A 다시 보내기 copy repeats an alert on stream; lists and totals keep the original only. */
const originals = (items: AlertItem[]) => items.filter((a) => !a.replayOf);
export const countedDonations = (items: AlertItem[]) => items.filter(counts);

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
 * Top donors by FN in the period, ties broken by who donated first. Rows group by the alert's opaque `donorKey` and show
 * the donor's latest name, so a supporter who copies the #1's name as an 별명 gets a row of their own. A hidden
 * profile (익명) is left out (2026-10-08 결정 "명예의 전당·랭킹에서 익명 제외"). Alerts without a key (seed history) group by the name shown.
 * 계정 / 후원시 설정한 이름 both use the name shown on the alert (TBD).
 */
export function rankingRows(items: AlertItem[], s: RankingSettings, now = new Date()): WidgetRankRow[] {
  const since = rankingSince(s.period, now);
  const totals = new Map<string, { name: string; fn: number; first: number }>();
  for (const a of countedDonations(items)) {
    const t = Date.parse(a.createdAt);
    const key = a.donorKey === undefined ? (a.donor === HIDDEN_PROFILE_LABEL ? null : `name:${a.donor}`) : a.donorKey;
    if (t < since || key === null) continue;
    const cur = totals.get(key) ?? { name: a.donor, fn: 0, first: t };
    cur.fn += a.fnAmount;
    cur.name = a.donor;
    totals.set(key, cur);
  }
  return [...totals.values()]
    .sort((x, y) => y.fn - x.fn || x.first - y.first)
    .slice(0, s.ranks)
    .map((v, i) => ({ rank: i + 1, name: v.name, fnAmount: v.fn }));
}

/** 크루 후원 순위: crew members by FN donated for them (멤버 지정) in the period; members with nothing are left out. */
export function crewRankingRows(
  attributions: { memberId: string; fnAmount: number; at: string }[],
  members: { id: string; name: string }[],
  s: Pick<RankingSettings, "period" | "ranks">,
  now = new Date()
): WidgetRankRow[] {
  const since = rankingSince(s.period, now);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const totals = new Map<string, number>();
  for (const a of attributions) {
    if (Date.parse(a.at) < since || !names.has(a.memberId)) continue;
    totals.set(a.memberId, (totals.get(a.memberId) ?? 0) + a.fnAmount);
  }
  return [...totals]
    .filter(([, fn]) => fn > 0)
    .sort((x, y) => y[1] - x[1] || names.get(x[0])!.localeCompare(names.get(y[0])!))
    .slice(0, s.ranks)
    .map(([id, fn], i) => ({ rank: i + 1, name: names.get(id)!, fnAmount: fn }));
}

const SOURCE_ORDER = ["SOMNATION", "YOUTUBE", "CHZZK", "SOOP", "FLEXTV"];

/** A unit's name in a 수단별 보드 row: a currency by its ISO code (YouTube KRW · USD), a platform unit by its label. */
const boardUnitName = (u: AmountUnit) => (isCurrencyUnit(u) ? u : unitLabel(u));

/**
 * 수단별 보드: Somnation FN donations and each platform's donations in their own unit (no FN rate — TBD), ordered by
 * 건수. A platform paying in two currencies gets a line per currency. 테스트 후원 never counts. Rows group by unit code;
 * alerts stored before the codes (label) are read as their code, so they join the same row.
 */
export function sourceBoardRows(items: AlertItem[], s: Pick<RankingSettings, "period" | "ranks">, now = new Date()): WidgetRankRow[] {
  const since = rankingSince(s.period, now);
  const groups = new Map<string, { source: string; unit: AmountUnit; value: number; count: number }>();
  for (const a of originals(items)) {
    if (Date.parse(a.createdAt) < since) continue;
    const g =
      a.kind === "DONATION"
        ? counts(a)
          ? { source: "SOMNATION", unit: "FN", value: a.fnAmount }
          : null
        : a.kind === "EXTERNAL" && a.platform && a.native
          ? { source: a.platform, ...nativeAmount(a.native) }
          : null;
    if (!g) continue;
    const key = `${g.source}|${g.unit}`;
    const cur = groups.get(key) ?? { source: g.source, unit: g.unit, value: 0, count: 0 };
    cur.value += g.value;
    cur.count += 1;
    groups.set(key, cur);
  }
  const list = [...groups.values()];
  const perSource = (src: string) => list.filter((x) => x.source === src).length;
  return list
    .sort((x, y) => y.count - x.count || SOURCE_ORDER.indexOf(x.source) - SOURCE_ORDER.indexOf(y.source) || boardUnitName(x.unit).localeCompare(boardUnitName(y.unit)))
    .slice(0, s.ranks)
    .map((x, i) => {
      const label = x.source === "SOMNATION" ? "썸네이션 FN" : PLATFORM_LABEL[x.source as Platform];
      return {
        rank: i + 1,
        name: `${perSource(x.source) > 1 ? `${label} ${boardUnitName(x.unit)}` : label} · ${formatNumber(x.count)}건`,
        fnAmount: x.source === "SOMNATION" ? x.value : 0,
        amountLabel: formatUnitAmount(x.value, x.unit)
      };
    });
}

/** `{rank}` · `{name}` · `{amount}` in a 후원랭킹 format part; `amountLabel` (수단별 보드: each row's own unit) wins. */
export const fillRank = (t: string, rank: number, name: string, amount: number, amountLabel?: string) =>
  t.replaceAll("{rank}", String(rank)).replaceAll("{name}", name).replaceAll("{amount}", amountLabel ?? formatNumber(amount));

/** The amount part of a row: the 금액 format, or the row's own label on 수단별 보드 (units differ, so no FN template). */
export const rankAmountText = (t: string, r: { rank: number; name: string; fnAmount: number; amountLabel?: string }) =>
  r.amountLabel ?? fillRank(t, r.rank, r.name, r.fnAmount);

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
  return originals(items)
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
  const latest = originals(items)
    .slice(-Math.max(1, s.maxLines))
    .map((a) => line(a, EVENT_LINE));
  return s.order === "최신순" ? latest.reverse() : latest;
}
