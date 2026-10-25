import {
  DEFAULT_GAUGE,
  GAUGE_NUMBERS,
  PLEDGE_GOAL_MAX,
  PLEDGE_TEXT_MAX,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  goalPercent,
  type GaugeLive,
  type GaugeSettings,
  type MemberPledge,
  type ScoreRow
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * BJ 공약 · 출근 BJ 게이지 (server-only) — code-first, StreamDonate BJ 게이지 · BJ 공약 · 출근 참고. Each member may have a
 * 공약 and a goal (broadcast score); the gauge shows 출근 (활동 중) members' scores against their goals on OBS, and the 공약 is
 * public on the 후원 페이지. Display points only: reaching a goal moves nothing.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
const hasForbidden = (s: string, forbidden: string[]) => forbidden.some((w) => s.toLowerCase().includes(w));

/** The channel's 공약 of current crew members (entries of removed members are left out). */
export function pledgesOf(channelId: string): Record<string, MemberPledge> {
  const all = mockCrew.pledges?.[channelId] ?? {};
  return Object.fromEntries((mockCrew.crews[channelId] ?? []).filter((m) => all[m.id]).map((m) => [m.id, all[m.id]]));
}

export const gaugeSettingsOf = (channelId: string): GaugeSettings => mockCrew.gauges?.[channelId] ?? DEFAULT_GAUGE;

/**
 * Validates the 공약 of the members sent ({ memberId: { text, goal } }, the whole list): members of the crew, text up to
 * PLEDGE_TEXT_MAX (public — 금지어 checked), goal a whole number 0 ~ PLEDGE_GOAL_MAX. A member with neither is left out.
 */
export function parsePledges(input: unknown, forbidden: string[], memberIds: string[]): { pledges: Record<string, MemberPledge> } | { message: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { message: "공약을 확인해 주세요." };
  const out: Record<string, MemberPledge> = {};
  for (const [id, raw] of Object.entries(input)) {
    if (!memberIds.includes(id)) return { message: "멤버를 찾을 수 없어요." };
    const v = rec(raw);
    const text = typeof v.text === "string" ? v.text.trim() : "";
    if (text.length > PLEDGE_TEXT_MAX) return { message: `공약은 ${PLEDGE_TEXT_MAX}자 이내로 입력해 주세요.` };
    if (hasForbidden(text, forbidden)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (typeof v.goal !== "number" || !Number.isInteger(v.goal) || v.goal < 0 || v.goal > PLEDGE_GOAL_MAX) return { message: `목표 점수는 0 ~ ${PLEDGE_GOAL_MAX.toLocaleString("ko-KR")}점으로 입력해 주세요.` };
    if (text || v.goal) out[id] = { text, goal: v.goal };
  }
  return { pledges: out };
}

export function parseGauge(input: unknown, forbidden: string[]): GaugeSettings | { message: string } {
  const v = rec(input);
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > PRIZE_TITLE_MAX) return { message: `제목은 ${PRIZE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (hasForbidden(title, forbidden)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  const numbers = GAUGE_NUMBERS.find((n) => n.key === v.numbers)?.key;
  if (!numbers) return { message: "숫자 표시를 골라 주세요." };
  const placement = PRIZE_PLACEMENTS.find((p) => p.key === v.placement)?.key;
  if (!placement) return { message: "배치를 골라 주세요." };
  if (typeof v.activeOnly !== "boolean" || typeof v.showPledge !== "boolean") return { message: "표시 설정을 확인해 주세요." };
  return { title, activeOnly: v.activeOnly, showPledge: v.showPledge, numbers, placement };
}

/**
 * The gauge of a live broadcast. `scoreboard`: its main scoreboard rows (the scores). Members with a goal, in crew order;
 * with `activeOnly` (출근 BJ만) only members 활동 중.
 */
export function gaugeLive(b: MockBroadcast, scoreboard: ScoreRow[]): GaugeLive {
  const settings = gaugeSettingsOf(b.channelId);
  const pledges = pledgesOf(b.channelId);
  const scores = new Map(scoreboard.map((r) => [r.memberId, r.score]));
  const rows = (mockCrew.crews[b.channelId] ?? [])
    .filter((m) => (pledges[m.id]?.goal ?? 0) > 0 && (m.active || !settings.activeOnly))
    .map((m) => {
      const { goal, text } = pledges[m.id];
      const score = scores.get(m.id) ?? 0;
      return { memberId: m.id, name: m.name, color: m.color, active: m.active, score, goal, percent: goalPercent(score, goal), reached: score >= goal, pledge: text };
    });
  return { settings: structuredClone(settings), visible: !!b.gauge?.visible, rows };
}
