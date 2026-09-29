"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import {
  ADJUST_REASON_MAX,
  BROADCAST_TITLE_MAX,
  MAX_ADJUST_POINTS,
  type BroadcastLive,
  type BroadcastResult,
  type BroadcastSummary,
  type BroadcastView,
  type ScoreRow,
  type TeamKey
} from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 크루 방송 (회차 · 점수판 · 이력) — code-first (no Figma frame). Studio route
 * `/creator/crew/broadcast`, OBS overlay `/overlay/crew/[key]`.
 *
 * A member's score = FN donated to them during the broadcast (server records) + manual 보정 points
 * from the remote. Points are display scores, not money. Each 보정 carries an id so a double click
 * never applies twice. TBD: 상금/prize mapping, presets, multi-platform donation feeds, overlay
 * styles, whether scores may go negative.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew broadcast API is not connected yet.");
};

const broadcasts = () => (mockCrew.broadcasts ??= []);
const members = () => mockCrew.crews[STUDIO_CHANNEL] ?? [];
const liveOf = (channelId: string) => broadcasts().find((b) => b.channelId === channelId && !b.endedAt) ?? null;

function scoreRows(b: MockBroadcast): ScoreRow[] {
  const end = b.endedAt ?? new Date(Date.now() + 1000).toISOString();
  const rows = members()
    .filter((m) => m.active || b.teams[m.id] !== undefined || b.adjustments.some((a) => a.memberId === m.id))
    .map((m) => {
      const donatedFn = mockCrew.attributions
        .filter((a) => a.channelId === b.channelId && a.memberId === m.id && a.at >= b.startedAt && a.at <= end)
        .reduce((s, a) => s + a.fnAmount, 0);
      const adjust = b.adjustments.filter((a) => a.memberId === m.id).reduce((s, a) => s + a.points, 0);
      return { memberId: m.id, name: m.name, color: m.color, team: b.teams[m.id] ?? null, donatedFn, adjust, score: donatedFn + adjust };
    });
  return rows.sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
}

function liveView(b: MockBroadcast): BroadcastLive {
  const rows = scoreRows(b);
  const byId = new Map(members().map((m) => [m.id, m.name]));
  return {
    id: b.id,
    title: b.title,
    startedAt: b.startedAt,
    teamMode: b.teamMode,
    rows,
    teams: b.teamMode ? (["A", "B"] as TeamKey[]).map((key) => ({ key, score: rows.filter((r) => r.team === key).reduce((s, r) => s + r.score, 0) })) : [],
    logs: [...b.adjustments].reverse().slice(0, 30).map((a) => ({ id: a.id, at: a.at, memberName: byId.get(a.memberId) ?? "삭제된 멤버", points: a.points, reason: a.reason }))
  };
}

function summary(b: MockBroadcast): BroadcastSummary {
  const final = b.final ?? scoreRows(b).map((r) => ({ memberId: r.memberId, name: r.name, score: r.score }));
  return {
    id: b.id,
    title: b.title,
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
    history: broadcasts()
      .filter((b) => b.channelId === STUDIO_CHANNEL && b.endedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20)
      .map(summary),
    overlayPath: `/overlay/crew/${mockCreator.integrationKey}`
  };
}

export async function startBroadcast(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { title?: unknown; teamMode?: unknown; teams?: unknown };
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (!title || title.length > BROADCAST_TITLE_MAX) return { status: "INVALID", message: `방송 제목을 1~${BROADCAST_TITLE_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => title.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
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
  await mockDelay(300);
  broadcasts().push({
    id: `bc-${Date.now().toString(36)}`,
    channelId: STUDIO_CHANNEL,
    title,
    startedAt: new Date().toISOString(),
    endedAt: null,
    teamMode: v.teamMode,
    teams,
    adjustments: [],
    final: null
  });
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

export async function endBroadcast(broadcastId: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveOf(STUDIO_CHANNEL);
  if (!live || live.id !== broadcastId) return { status: "SAVED" }; // already ended: idempotent
  await mockDelay(300);
  live.endedAt = new Date().toISOString();
  live.final = scoreRows(live).map((r) => ({ memberId: r.memberId, name: r.name, score: r.score }));
  return { status: "SAVED" };
}

/**
 * OBS overlay read (no login: OBS browser sources cannot sign in). The integration key in the URL is
 * the secret — reissuing it on 계정설정 invalidates old overlay URLs. TBD: a dedicated overlay token.
 */
export async function getOverlayScoreboard(overlayKey: unknown): Promise<BroadcastLive | "IDLE" | "FORBIDDEN"> {
  assertMock();
  if (typeof overlayKey !== "string" || overlayKey !== mockCreator.integrationKey) return "FORBIDDEN";
  const live = liveOf(STUDIO_CHANNEL);
  if (!live) return "IDLE";
  const view = liveView(live);
  return { ...view, logs: [] };
}
