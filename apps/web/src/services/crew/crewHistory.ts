"use server";

import { toCsv } from "@/lib/csv";
import { formatKstTime } from "@/lib/format";
import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { scoreboardRows } from "./crewCore";
import { contributionLines } from "./crewHistoryCore";
import { CONTRIBUTION_EXPORT_MAX, CONTRIBUTION_KINDS, type ContributionExportResult, type ContributionResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 기여도 내역 Server Actions — code-first (no Figma frame; StreamDonate 참고), part of `/creator/crew/broadcast`. Read on
 * demand (not with the 3-second board refresh): every score line of one of the channel's broadcasts, live or ended, and
 * the 기여도 내보내기 files (one broadcast, or every 회차 of a project — StreamDonate 프리셋별 기여도 내역). Studio only —
 * they name donors and 보정 사유.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew contribution history API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const ofChannel = () => (mockCrew.broadcasts ?? []).filter((b) => b.channelId === STUDIO_CHANNEL);

export async function getContributionHistory(input: unknown): Promise<ContributionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const b = ofChannel().find((x) => x.id === rec(input).broadcastId);
  if (!b) return { status: "INVALID", message: "방송을 찾을 수 없어요." };
  return { status: "OK", history: { broadcastId: b.id, title: b.title, lines: contributionLines(b) } };
}

const KIND_LABEL = Object.fromEntries(CONTRIBUTION_KINDS.map((k) => [k.key, k.label]));
const stamp = (iso: string) => formatKstTime(iso, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** A 회차's column / cell name: "3회차" in a project, else the start date and title; "(진행 중)" while live. */
const roundName = (b: MockBroadcast) =>
  `${b.round ? `${b.round}회차` : `${formatKstTime(b.startedAt, { month: "2-digit", day: "2-digit" })} ${b.title}`}${b.endedAt ? "" : " (진행 중)"}`;
/** Characters a file name cannot hold become _. */
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim() || "방송";

/**
 * 기여도 내보내기 as CSV: `broadcastId` (one broadcast, LINES only), or `project` (a project name, or null for the broadcasts
 * started without one — every 회차 oldest first, the live one included). ROUNDS: members × 회차 with each 회차's final
 * score (the live one's current score), 합계 per member and a 합계 row, best total first. LINES: every 기여도 내역 line, with
 * its 회차 — recomputed with today's 자동엑셀 settings, so it can differ from ROUNDS if those changed after a 회차 ended.
 */
export async function exportContributions(input: unknown): Promise<ContributionExportResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (v.format !== "ROUNDS" && v.format !== "LINES") return { status: "INVALID", message: "내보낼 형식을 골라 주세요." };
  let list: MockBroadcast[];
  let name: string;
  if (v.broadcastId !== undefined) {
    const b = ofChannel().find((x) => x.id === v.broadcastId);
    if (!b) return { status: "INVALID", message: "방송을 찾을 수 없어요." };
    if (v.format !== "LINES") return { status: "INVALID", message: "회차별 합계는 프로젝트로 내보내 주세요." };
    list = [b];
    name = `기여도내역-${fileSafe(b.title)}`;
  } else {
    if (v.project !== null && typeof v.project !== "string") return { status: "INVALID", message: "프로젝트를 골라 주세요." };
    list = ofChannel()
      .filter((b) => (b.project ?? null) === v.project)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    if (!list.length) return { status: "INVALID", message: "내보낼 방송이 없어요." };
    name = `기여도-${fileSafe((v.project as string | null) ?? "프로젝트 없음")}-${v.format === "ROUNDS" ? "회차별" : "상세"}`;
  }

  if (v.format === "ROUNDS") {
    const scores = list.map((b) => new Map((b.final ?? scoreboardRows(b)).map((r) => [r.memberId, { name: r.name, score: r.score }])));
    const crew = new Map((mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => [m.id, m.name]));
    const ids = [...new Set(scores.flatMap((m) => [...m.keys()]))];
    const rows = ids
      .map((id) => {
        const each = scores.map((m) => m.get(id)?.score ?? 0);
        // The current name, else the name of their last 회차.
        const last = [...scores].reverse().find((m) => m.has(id))!.get(id)!.name;
        return { name: crew.get(id) ?? last, each, total: each.reduce((s, x) => s + x, 0) };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const totals = list.map((_, i) => rows.reduce((s, r) => s + r.each[i], 0));
    const csv = toCsv(
      ["멤버", ...list.map(roundName), "합계"],
      [...rows.map((r) => [r.name, ...r.each, r.total]), ["합계", ...totals, totals.reduce((s, x) => s + x, 0)]]
    );
    return { status: "OK", csv, filename: `${name}.csv`, rows: rows.length, truncated: false };
  }

  // Oldest first within each 회차 (the screen shows newest first), 직급 배수 for the whole 회차 last.
  const oldestFirst = (b: MockBroadcast) => contributionLines(b).sort((x, y) => (x.at === y.at ? x.id.localeCompare(y.id) : x.at === null ? 1 : y.at === null ? -1 : x.at.localeCompare(y.at)));
  const lines = list.flatMap((b) => oldestFirst(b).map((l) => ({ b, l })));
  const shown = lines.slice(0, CONTRIBUTION_EXPORT_MAX);
  const csv = toCsv(
    ["회차", "방송", "시각", "멤버", "종류", "내용", "상세", "점수"],
    shown.map(({ b, l }) => [roundName(b), b.title, l.at ? stamp(l.at) : "방송 전체", l.memberName, KIND_LABEL[l.kind], l.label, l.detail, l.points])
  );
  return { status: "OK", csv, filename: `${name}.csv`, rows: shown.length, truncated: lines.length > shown.length };
}
