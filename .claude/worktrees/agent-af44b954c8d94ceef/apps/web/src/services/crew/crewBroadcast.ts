"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { sameSecret } from "@/lib/secret";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import {
  ADJUST_REASON_MAX,
  BROADCAST_TITLE_MAX,
  MAX_ADJUST_POINTS,
  OVERLAY_BOARD_ROWS,
  PROJECT_NAME_MAX,
  rankUpPair,
  type FeedSourceKey,
  type FeedSummaryRow,
  type Battle,
  type FeedView,
  type BroadcastLive,
  type OverlayScoreboard,
  type BroadcastResult,
  type BroadcastSummary,
  type BroadcastView,
  type ScoreRow,
  type TeamKey
} from "./crewTypes";
import { battleBonus, battleRulesOf, fanNotesView, gradeBonus, gradeMultipliersOf, excelOf, feedOf, liveBroadcastOf, scoreEntry, scoreFn, stealRecordView, stealRulesOf, timesMultiplier, windowReceived, windowScores, windowSteals } from "./crewCore";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 크루 방송 (회차 · 점수판 · 이력) — code-first (no Figma frame). Studio route
 * `/creator/crew/broadcast`, OBS overlay `/overlay/crew/[key]`.
 *
 * A member's score = points for donations to them during the broadcast (server records; 자동엑셀
 * converts each unit and applies 배수 규칙 · 수기 기여도) + manual 보정 points from the remote. Points are display scores, not money. Each 보정 carries an id so a double click
 * never applies twice. TBD: 상금/prize mapping, presets, multi-platform donation feeds, overlay
 * styles, whether scores may go negative.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew broadcast API is not connected yet.");
};

const broadcasts = () => (mockCrew.broadcasts ??= []);
const members = () => mockCrew.crews[STUDIO_CHANNEL] ?? [];
const liveOf = liveBroadcastOf;

/** Every 후원 리스트 entry with its points under the channel's current 자동엑셀 settings. */
const scoredFeed = (b: MockBroadcast) => {
  const s = excelOf(b.channelId);
  return feedOf(b).map((f) => scoreEntry(f, s));
};

function scoreRows(b: MockBroadcast): ScoreRow[] {
  const end = b.endedAt ?? new Date(Date.now() + 1000).toISOString();
  const s = excelOf(b.channelId);
  const feed = scoredFeed(b);
  const bonus = battleBonus(b);
  const graded = gradeBonus(b);
  const rows = members()
    .filter((m) => m.active || b.teams[m.id] !== undefined || b.adjustments.some((a) => a.memberId === m.id) || (b.feed ?? []).some((f) => f.memberId === m.id) || (b.steals ?? []).some((x) => x.thief === m.id || x.target === m.id))
    .map((m) => {
      const donated = mockCrew.attributions
        .filter((a) => a.channelId === b.channelId && a.memberId === m.id && a.at >= b.startedAt && a.at <= end)
        .reduce((sum, a) => sum + scoreFn(a.fnAmount, s), 0);
      const adjust = b.adjustments.filter((a) => a.memberId === m.id).reduce((sum, a) => sum + a.points, 0);
      const fromFeed = feed.filter((f) => f.status === "ASSIGNED" && f.memberId === m.id).reduce((sum, f) => sum + f.points, 0);
      const stolen = (b.steals ?? []).reduce((sum, x) => sum + (x.thief === m.id ? x.points : 0) - (x.target === m.id ? x.points : 0), 0);
      const battle = bonus.get(m.id) ?? 0;
      const grade = graded.get(m.id) ?? 0;
      return { memberId: m.id, name: m.name, color: m.color, team: b.teams[m.id] ?? null, donated, feed: fromFeed, adjust, stolen, battle, grade, score: donated + fromFeed + adjust + stolen + battle + grade };
    });
  return rows.sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
}

function liveView(b: MockBroadcast): BroadcastLive {
  const rows = scoreRows(b);
  const rankUp = rankUpPair(rows);
  const byId = new Map(members().map((m) => [m.id, m.name]));
  return {
    id: b.id,
    title: b.title,
    project: b.project ?? null,
    round: b.round ?? null,
    oneshotPot: b.oneshot ? scoredFeed(b).filter((f) => f.status === "POT").reduce((s, f) => s + f.points, 0) : null,
    startedAt: b.startedAt,
    teamMode: b.teamMode,
    rows,
    teams: b.teamMode ? (["A", "B"] as TeamKey[]).map((key) => ({ key, score: rows.filter((r) => r.team === key).reduce((s, r) => s + r.score, 0) })) : [],
    logs: [...b.adjustments].reverse().slice(0, 30).map((a) => ({ id: a.id, at: a.at, memberName: byId.get(a.memberId) ?? "삭제된 멤버", points: a.points, reason: a.reason })),
    subBoards: (b.subBoards ?? []).map((s) => ({ no: s.no, title: s.title, openedAt: s.openedAt, closedAt: s.closedAt, rows: windowRows(b, s.openedAt, s.closedAt) })),
    battles: (b.battles ?? []).map((x) => battleView(b, x)),
    steals: [...(b.steals ?? [])].reverse().slice(0, 30).map((x) => stealRecordView(b.channelId, x)),
    scenario: b.scenario
      ? {
          parts: structuredClone(b.scenario.parts),
          current: b.scenario.current,
          history: b.scenario.history.map((h) => ({ ...h, title: b.scenario!.parts[h.index]?.title ?? `${h.index + 1}부` }))
        }
      : null,
    rankUp,
    showRankUp: !!b.showRankUp,
    fanNotes: fanNotesView(b),
    serverNow: new Date().toISOString()
  };
}

const TEAM_COLOR = { A: "#3b82f6", B: "#ec4899" } as const;

/** One 실시간 배틀 with side scores over its window (start → stop or time-out, whichever is first). */
function battleView(b: MockBroadcast, x: NonNullable<MockBroadcast["battles"]>[number], now = Date.now()): Battle {
  const endMs = Math.min(new Date(x.endsAt).getTime(), x.stoppedAt ? new Date(x.stoppedAt).getTime() : Infinity);
  const running = endMs > now;
  const to = running ? null : new Date(endMs).toISOString();
  const received = windowReceived(b, x.startedAt, to);
  const steals = windowSteals(b, x.startedAt, to);
  const byId = new Map(members().map((m) => [m.id, m]));
  const multiplier = x.multiplier ?? 1;
  const sum = (scores: Map<string, number>, ids: string[]) => ids.reduce((s, id) => s + (scores.get(id) ?? 0), 0);
  const side = (key: "A" | "B", ids: string[]) => {
    const one = x.mode === "MEMBERS" ? byId.get(ids[0]) : undefined;
    return {
      key,
      label: x.mode === "MEMBERS" ? (one?.name ?? "삭제된 멤버") : `${key}팀`,
      color: one?.color ?? TEAM_COLOR[key],
      memberIds: [...ids],
      // 배틀 배수 multiplies what the side received; 기여도 강탈 moves points as they are (2026-10-07 결정).
      score: timesMultiplier(sum(received, ids), multiplier) + sum(steals, ids)
    };
  };
  const sides: [Battle["sides"][0], Battle["sides"][1]] = [side("A", x.a), side("B", x.b)];
  const [a, c] = sides;
  const leader = a.score === 0 && c.score === 0 ? null : a.score === c.score ? "DRAW" : a.score > c.score ? "A" : "B";
  return { no: x.no, title: x.title, mode: x.mode, startedAt: x.startedAt, endsAt: x.endsAt, stoppedAt: x.stoppedAt, running, remainingSec: running ? Math.ceil((endMs - now) / 1000) : 0, sides, multiplier, penalty: x.penalty ?? "", leader };
}

/** 서브 점수판 rows: points donated to each active member between `from` and `to` (open board = now). */
function windowRows(b: MockBroadcast, from: string, to: string | null) {
  const scores = windowScores(b, from, to);
  return members()
    .filter((m) => m.active)
    .map((m) => ({ memberId: m.id, name: m.name, color: m.color, score: scores.get(m.id) ?? 0 }))
    .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
}

function feedView(b: MockBroadcast): FeedView {
  const scored = scoredFeed(b);
  const pot = scored.filter((f) => f.status === "POT");
  return {
    assignMode: b.assignMode ?? "AUTO",
    keywords: structuredClone(mockCrew.keywords ?? {}),
    entries: structuredClone(scored.reverse().slice(0, 200)),
    oneshot: b.oneshot ? { startedAt: b.oneshot.startedAt, potPoints: pot.reduce((s, f) => s + f.points, 0), count: pot.length } : null,
    excel: structuredClone(excelOf(b.channelId)),
    summary: feedSummary(b)
  };
}

/** 플랫폼 · BJ별 정리: assigned points per source for each member, plus everything not yet assigned. */
function feedSummary(b: MockBroadcast): FeedSummaryRow[] {
  const counted = scoredFeed(b).filter((f) => f.status !== "CANCELLED");
  const row = (memberId: string | null, name: string, color: string | null, list: typeof counted): FeedSummaryRow => {
    const points: Partial<Record<FeedSourceKey, number>> = {};
    for (const f of list) {
      const k: FeedSourceKey = f.source === "BANK" ? "BANK" : (f.platform ?? "SOMNATION");
      points[k] = (points[k] ?? 0) + f.points;
    }
    return { memberId, name, color, points, total: list.reduce((s, f) => s + f.points, 0) };
  };
  const rows = members()
    .filter((m) => m.active || counted.some((f) => f.memberId === m.id))
    .map((m) => row(m.id, m.name, m.color, counted.filter((f) => f.status === "ASSIGNED" && f.memberId === m.id)));
  rows.push(row(null, "미지정 · 대기 · 한방", null, counted.filter((f) => f.status !== "ASSIGNED")));
  return rows;
}

function summary(b: MockBroadcast): BroadcastSummary {
  const final = b.final ?? scoreRows(b).map((r) => ({ memberId: r.memberId, name: r.name, score: r.score }));
  return {
    id: b.id,
    title: b.title,
    project: b.project ?? null,
    round: b.round ?? null,
    startedAt: b.startedAt,
    endedAt: b.endedAt ?? "",
    totalScore: final.reduce((s, r) => s + r.score, 0),
    winner: final[0] && final[0].score > 0 ? final[0].name : null,
    top: final.slice(0, 3).map(({ name, score }) => ({ name, score }))
  };
}

export async function getBroadcastView(): Promise<BroadcastView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(200);
  const live = liveOf(STUDIO_CHANNEL);
  return {
    members: structuredClone(members()),
    live: live ? liveView(live) : null,
    feed: live ? feedView(live) : null,
    keywords: structuredClone(mockCrew.keywords ?? {}),
    stealSlots: structuredClone(mockCrew.stealSlots?.[STUDIO_CHANNEL] ?? []),
    stealRules: { ...stealRulesOf(STUDIO_CHANNEL) },
    battleRules: { ...battleRulesOf(STUDIO_CHANNEL) },
    scenario: structuredClone(mockCrew.scenario?.[STUDIO_CHANNEL] ?? []),
    projects: [...new Set(broadcasts().filter((b) => b.channelId === STUDIO_CHANNEL && b.project).map((b) => b.project as string))],
    history: broadcasts()
      .filter((b) => b.channelId === STUDIO_CHANNEL && b.endedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20)
      .map(summary),
    overlayPath: `/overlay/crew/${mockCreator.integrationKey}`
  };
}

/**
 * Starts a broadcast. `requestId` (one per intended start) makes a retried or double-clicked start return SAVED
 * instead of a second broadcast. The checks and the write run without an await in between.
 */
export async function startBroadcast(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(300);
  const v = (typeof input === "object" && input !== null ? input : {}) as { requestId?: unknown; title?: unknown; teamMode?: unknown; teams?: unknown; project?: unknown };
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const requestId = v.requestId;
  if (broadcasts().some((b) => b.requestId === requestId)) return { status: "SAVED" };
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (!title || title.length > BROADCAST_TITLE_MAX) return { status: "INVALID", message: `방송 제목을 1~${BROADCAST_TITLE_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => title.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const project = typeof v.project === "string" ? v.project.trim() : "";
  if (project.length > PROJECT_NAME_MAX) return { status: "INVALID", message: `프로젝트 이름은 ${PROJECT_NAME_MAX}자 이내로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => project.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (typeof v.teamMode !== "boolean") return { status: "INVALID", message: "팀 모드를 확인해 주세요." };
  const teams: Record<string, TeamKey> = {};
  if (v.teamMode) {
    const raw = (typeof v.teams === "object" && v.teams !== null ? v.teams : {}) as Record<string, unknown>;
    for (const [memberId, team] of Object.entries(raw)) {
      if (!members().some((m) => m.id === memberId && m.active) || (team !== "A" && team !== "B")) return { status: "INVALID", message: "팀 배정을 확인해 주세요." };
      teams[memberId] = team;
    }
    const counts = Object.values(teams);
    if (!counts.includes("A") || !counts.includes("B")) return { status: "INVALID", message: "두 팀에 멤버를 한 명 이상씩 배정해 주세요." };
  }
  if (liveOf(STUDIO_CHANNEL)) return { status: "INVALID", message: "이미 진행 중인 방송이 있어요. 먼저 종료해 주세요." };
  broadcasts().push({
    id: `bc-${randomUUID()}`,
    requestId,
    channelId: STUDIO_CHANNEL,
    title,
    // 회차 = this project's broadcast count + 1 (numbered automatically on start).
    project: project || null,
    round: project ? broadcasts().filter((b) => b.channelId === STUDIO_CHANNEL && b.project === project).length + 1 : null,
    assignMode: "AUTO",
    feed: [],
    oneshot: null,
    simRequests: [],
    startedAt: new Date().toISOString(),
    endedAt: null,
    teamMode: v.teamMode,
    teams,
    adjustments: [],
    gradeMultipliers: gradeMultipliersOf(STUDIO_CHANNEL),
    final: null
  });
  return { status: "SAVED" };
}

/** 랭크업을 OBS 점수판에 표시 / 숨기기 (the studio always shows it). Setting the same value again is a no-op. */
export async function setRankUpOverlay(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const live = liveOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  if (typeof v.on !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  live.showRankUp = v.on;
  return { status: "SAVED" };
}

/** Manual 보정 from the remote. `adjustmentId` makes a retried click a no-op. */
export async function adjustScore(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const live = liveOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  if (typeof v.adjustmentId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.adjustmentId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  if (live.adjustments.some((a) => a.id === v.adjustmentId)) return { status: "SAVED" };
  if (!members().some((m) => m.id === v.memberId)) return { status: "INVALID", message: "멤버를 찾을 수 없어요." };
  const points = v.points;
  if (typeof points !== "number" || !Number.isSafeInteger(points) || points === 0 || Math.abs(points) > MAX_ADJUST_POINTS) {
    return { status: "INVALID", message: "보정 점수를 확인해 주세요." };
  }
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length > ADJUST_REASON_MAX) return { status: "INVALID", message: `사유는 ${ADJUST_REASON_MAX}자 이내로 입력해 주세요.` };
  live.adjustments.push({ id: v.adjustmentId, at: new Date().toISOString(), memberId: v.memberId as string, points, reason: reason || (points > 0 ? "보정 +" : "보정 −") });
  await mockDelay(150);
  return { status: "SAVED" };
}

/**
 * Ends the live broadcast and freezes its result. Idempotent: a second call (double click, retry) finds it ended and
 * returns SAVED without touching the first call's 종료 시각 · 최종 순위 (no await between the check and the write).
 */
export async function endBroadcast(broadcastId: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(300);
  const live = liveOf(STUDIO_CHANNEL);
  if (!live || live.id !== broadcastId) return { status: "SAVED" }; // already ended: idempotent
  // An open 한방 is closed without a winner: its pot goes back to 미지정 (never scored).
  if (live.oneshot) {
    for (const f of live.feed ?? []) if (f.status === "POT") Object.assign(f, { status: "UNMATCHED", oneshot: false });
    live.oneshot = null;
  }
  live.endedAt = new Date().toISOString();
  for (const s of live.subBoards ?? []) s.closedAt ??= live.endedAt;
  for (const x of live.battles ?? []) if (new Date(x.endsAt).getTime() > Date.now()) x.stoppedAt ??= live.endedAt;
  if (live.scenario) {
    for (const h of live.scenario.history) h.endedAt ??= live.endedAt;
    live.scenario.current = null;
  }
  live.final = scoreRows(live).map((r) => ({ memberId: r.memberId, name: r.name, score: r.score }));
  return { status: "SAVED" };
}

/**
 * OBS overlay read (no login: OBS browser sources cannot sign in). The integration key in the URL is
 * the secret — reissuing it on 계정설정 invalidates old overlay URLs. TBD: a dedicated overlay token.
 */
export async function getOverlayScoreboard(overlayKey: unknown): Promise<OverlayScoreboard | "IDLE" | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(overlayKey, mockCreator.integrationKey)) return "FORBIDDEN";
  const live = liveOf(STUDIO_CHANNEL);
  if (!live) return "IDLE";
  const view = liveView(live);
  // The overlay page is reachable with the key alone: operator logs, 시나리오 메모 and viewers' notes (with nicknames,
  // hidden ones too) stay in the studio.
  return {
    ...view,
    logs: [],
    scenario: view.scenario && { ...view.scenario, parts: view.scenario.parts.map(({ title, minutes }) => ({ title, minutes })) },
    fanNotes: { open: view.fanNotes.open, rules: view.fanNotes.rules, notes: [], counts: { NEW: 0, DONE: 0, HIDDEN: 0 } },
    // 랭크업 between members who are on the board; a closer pair further down would name people OBS does not show.
    rankUp: rankUpPair(view.rows.slice(0, OVERLAY_BOARD_ROWS))
  };
}
