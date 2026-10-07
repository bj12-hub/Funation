"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { gradesOf, memberRanking, parseGrades } from "./crewCore";
import { CREW_ROLES, MAX_CREW_MEMBERS, MEMBER_NAME_RULE, type CrewPublic, type CrewRole, type CrewSaveResult, type CrewStudioView } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * Crew (크루) Server Actions — code-first (no Figma frame). Studio route `/creator/crew`; the public
 * crew feeds the creator-room donation panel. TBD: earnings split between members, member accounts
 * / invitations, member removal while a broadcast is running, audit of crew changes.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew API is not connected yet.");
};

const crew = () => (mockCrew.crews[STUDIO_CHANNEL] ??= []);
const PALETTE = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#ef4444"];

function checkName(name: unknown, exceptId?: string): string | null {
  if (typeof name !== "string" || !MEMBER_NAME_RULE.test(name.trim())) return "멤버 이름은 1~12자의 한글, 영문, 숫자로 입력해 주세요.";
  const n = name.trim();
  if (MOCK_FORBIDDEN_WORDS.some((w) => n.toLowerCase().includes(w))) return "사용할 수 없는 단어가 포함되어 있어요.";
  if (crew().some((x) => x.id !== exceptId && x.name === n)) return "이미 등록된 멤버 이름이에요.";
  return null;
}

export async function getCrewStudio(): Promise<CrewStudioView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(250);
  const now = new Date();
  return {
    channelName: mockCreator.channelName,
    members: structuredClone(crew()),
    grades: structuredClone(gradesOf(STUDIO_CHANNEL)),
    ranking: memberRanking(STUDIO_CHANNEL),
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  };
}

/**
 * Adds a member. `requestId` (one per intended add) makes a retried or double-clicked add return SAVED instead of a
 * second member; the checks (limit, unique name) and the write run without an await in between.
 */
export async function addCrewMember(input: unknown): Promise<CrewSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(300);
  const v = (typeof input === "object" && input !== null ? input : {}) as { requestId?: unknown; name?: unknown; role?: unknown };
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const requests = (mockCrew.memberRequests ??= []);
  if (requests.includes(v.requestId)) return { status: "SAVED" };
  if (crew().length >= MAX_CREW_MEMBERS) return { status: "INVALID", message: `멤버는 최대 ${MAX_CREW_MEMBERS}명까지 등록할 수 있어요.` };
  if (!CREW_ROLES.some((r) => r.key === v.role)) return { status: "INVALID", message: "역할을 선택해 주세요." };
  const error = checkName(v.name);
  if (error) return { status: "INVALID", message: error };
  crew().push({
    id: `cm-${randomUUID()}`,
    name: (v.name as string).trim(),
    role: v.role as CrewRole,
    active: true,
    color: PALETTE[crew().length % PALETTE.length]
  });
  requests.push(v.requestId);
  return { status: "SAVED" };
}

export async function updateCrewMember(id: unknown, input: unknown): Promise<CrewSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  // Before the checks: a rename checked against names another save is about to write could duplicate one.
  await mockDelay(250);
  const target = crew().find((x) => x.id === id);
  if (!target) return { status: "INVALID", message: "멤버를 찾을 수 없어요." };
  const v = (typeof input === "object" && input !== null ? input : {}) as { name?: unknown; role?: unknown; active?: unknown; gradeId?: unknown };
  if (v.name !== undefined) {
    const error = checkName(v.name, target.id);
    if (error) return { status: "INVALID", message: error };
  }
  if (v.role !== undefined && !CREW_ROLES.some((r) => r.key === v.role)) return { status: "INVALID", message: "역할을 확인해 주세요." };
  if (v.active !== undefined && typeof v.active !== "boolean") return { status: "INVALID", message: "상태를 확인해 주세요." };
  if (v.gradeId !== undefined && v.gradeId !== null && !gradesOf(STUDIO_CHANNEL).some((g) => g.id === v.gradeId)) return { status: "INVALID", message: "직급을 확인해 주세요." };
  if (typeof v.name === "string") target.name = v.name.trim();
  if (v.role !== undefined) target.role = v.role as CrewRole;
  if (typeof v.active === "boolean") target.active = v.active;
  if (v.gradeId !== undefined) target.gradeId = (v.gradeId as string | null) ?? null;
  return { status: "SAVED" };
}

/**
 * 직급 (2026-10-06 결정): replaces the channel's grade list (names + 직급 배수). Members whose grade was removed go back
 * to none. A running broadcast's scoreboard follows the new 배수 at once (like 자동엑셀 settings).
 */
export async function saveCrewGrades(input: unknown): Promise<CrewSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { grades?: unknown };
  const grades = parseGrades(v.grades, MOCK_FORBIDDEN_WORDS, gradesOf(STUDIO_CHANNEL).map((g) => g.id));
  if ("message" in grades) return { status: "INVALID", message: grades.message };
  await mockDelay(200);
  (mockCrew.grades ??= {})[STUDIO_CHANNEL] = grades;
  for (const m of crew()) if (m.gradeId && !grades.some((g) => g.id === m.gradeId)) m.gradeId = null;
  return { status: "SAVED" };
}

/** Removes a member; their past attributions stay in history. Idempotent. */
export async function removeCrewMember(id: unknown): Promise<CrewSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(250);
  mockCrew.crews[STUDIO_CHANNEL] = crew().filter((x) => x.id !== id);
  return { status: "SAVED" };
}

/** Active crew members of a channel for the donation panel (public). */
export async function getCrewPublic(channelId: unknown): Promise<CrewPublic> {
  assertMock();
  if (typeof channelId !== "string") return { members: [] };
  const members = (mockCrew.crews[channelId] ?? []).filter((x) => x.active).map(({ id, name, role, color }) => ({ id, name, role, color }));
  return { members };
}
