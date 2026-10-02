import type { AssignMode, CrewMember, ExcelSettings, FeedEntry } from "./crewTypes";

/**
 * Development-only crew state, keyed by channel id: the studio creator's own channel
 * (`STUDIO_CHANNEL`) and one room creator (c4) so member targeting can be tried in a creator room.
 * `attributions` records which member a completed donation was sent for. Seed amounts give the
 * studio ranking some rows; they did not debit anyone.
 */

export const STUDIO_CHANNEL = "studio";

type Attribution = { donationId: string; channelId: string; memberId: string; fnAmount: number; at: string };

export type MockBroadcast = {
  id: string;
  channelId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  teamMode: boolean;
  teams: Record<string, "A" | "B">;
  adjustments: { id: string; at: string; memberId: string; points: number; reason: string }[];
  project?: string | null;
  round?: number | null;
  assignMode?: AssignMode;
  /** 후원 리스트 (newest last). */
  feed?: FeedEntry[];
  /** Active 한방 window. */
  oneshot?: { startedAt: string } | null;
  /** 시뮬 후원 request ids already accepted. */
  simRequests?: string[];
  /** 서브 점수판: window-scored boards under the main one (numbered from 1 per broadcast). */
  subBoards?: { no: number; title: string; openedAt: string; closedAt: string | null; requestId: string }[];
  /** 실시간 배틀: side A/B member ids, timer and the request ids already applied (start · time changes). */
  battles?: { no: number; title: string; mode: "MEMBERS" | "TEAMS"; a: string[]; b: string[]; startedAt: string; endsAt: string; stoppedAt: string | null; requests: string[] }[];
  /** Final ranking frozen at the end (members may be renamed or removed later). */
  final: { memberId: string; name: string; score: number }[] | null;
};

type MockCrew = {
  crews: Record<string, CrewMember[]>;
  attributions: Attribution[];
  broadcasts?: MockBroadcast[];
  /** 후원 리스트 keywords per member id (kept across broadcasts). */
  keywords?: Record<string, string[]>;
  /** 자동엑셀 settings per channel (kept across broadcasts). */
  excel?: Record<string, ExcelSettings>;
};

const m = (id: string, name: string, role: CrewMember["role"], color: string, active = true): CrewMember => ({ id, name, role, active, color });

function monthStamp(dayOffset: number) {
  const d = new Date();
  d.setDate(Math.max(1, d.getDate() - dayOffset));
  return d.toISOString();
}

const g = globalThis as typeof globalThis & { __funationMockCrewV1?: MockCrew };

export const mockCrew = (g.__funationMockCrewV1 ??= {
  crews: {
    [STUDIO_CHANNEL]: [m("cm-s1", "길동", "LEADER", "#8b5cf6"), m("cm-s2", "하늘", "MEMBER", "#ec4899"), m("cm-s3", "바다", "MEMBER", "#3b82f6"), m("cm-s4", "솔", "MEMBER", "#f59e0b", false)],
    c4: [m("cm-c4-1", "재형", "LEADER", "#8b5cf6"), m("cm-c4-2", "용주", "MEMBER", "#10b981"), m("cm-c4-3", "민수", "MEMBER", "#3b82f6")]
  },
  attributions: [
    { donationId: "seed-1", channelId: STUDIO_CHANNEL, memberId: "cm-s2", fnAmount: 50_000, at: monthStamp(2) },
    { donationId: "seed-2", channelId: STUDIO_CHANNEL, memberId: "cm-s1", fnAmount: 30_000, at: monthStamp(3) },
    { donationId: "seed-3", channelId: STUDIO_CHANNEL, memberId: "cm-s3", fnAmount: 12_000, at: monthStamp(1) },
    { donationId: "seed-4", channelId: STUDIO_CHANNEL, memberId: "cm-s2", fnAmount: 8_000, at: monthStamp(0) }
  ]
});
