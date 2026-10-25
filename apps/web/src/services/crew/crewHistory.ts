"use server";

import { toCsv } from "@/lib/csv";
import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { contributionLines, contributionTable } from "./crewHistoryCore";
import type { ContributionExportResult, ContributionResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

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

/**
 * 기여도 내보내기 as CSV (contributionTable, crewHistoryCore): `broadcastId` (one broadcast, LINES only), or `project` (a
 * project name, or null for the broadcasts started without one). The same table downloads as Excel from
 * `GET /api/creator/crew/contributions`.
 */
export async function exportContributions(input: unknown): Promise<ContributionExportResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const table = contributionTable(input);
  if ("message" in table) return { status: "INVALID", message: table.message };
  return { status: "OK", csv: toCsv(table.headers, table.rows), filename: `${table.name}.csv`, rows: table.count, truncated: table.truncated };
}
