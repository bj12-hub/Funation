import type { AssignMode, BattleRules, CrewGrade, FanNoteRules, CrewMember, ExcelSettings, FeedEntry, ScenarioPart, StealRules, StealSlot } from "./crewTypes";

/**
 * Development-only crew state, keyed by channel id: the studio creator's own channel
 * (`STUDIO_CHANNEL`) and one room creator (c4) so member targeting can be tried in a creator room.
 * `attributions` records which member a completed donation was sent for. Seed amounts give the
 * studio ranking some rows; they did not debit anyone. c4 starts with a live broadcast so the room's
 * 팬 메시지 · 요청사항 card can be tried from `/creators/c4` (the studio channel has no public room in the mock).
 */

export const STUDIO_CHANNEL = "studio";

/** `donor` · `donorId` · `message`: what the 크루 후원 list shows (donorId is empty for a hidden profile). */
type Attribution = { donationId: string; channelId: string; memberId: string; fnAmount: number; at: string; donor?: string; donorId?: string; message?: string };

export type MockBroadcast = {
  id: string;
  /** The start request (a retried start returns SAVED instead of a second broadcast); missing on the seed. */
  requestId?: string;
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
  /**
   * 직급 배수 per member (≠ 1) when the broadcast started. Grade edits apply from the next broadcast, so points
   * already moved (기여도 강탈) never rest on a 배수 that changed afterwards. Missing on broadcasts from before.
   */
  gradeMultipliers?: Record<string, number>;
  /** 랭크업 on the OBS scoreboard (2026-10-06). */
  showRankUp?: boolean;
  /** 시뮬 후원 request ids already accepted. */
  simRequests?: string[];
  /** 서브 점수판: window-scored boards under the main one (numbered from 1 per broadcast). */
  subBoards?: { no: number; title: string; openedAt: string; closedAt: string | null; requestId: string }[];
  /** 실시간 배틀: side A/B member ids, timer and the request ids already applied (start · time changes). */
  battles?: {
    no: number;
    title: string;
    mode: "MEMBERS" | "TEAMS";
    a: string[];
    b: string[];
    startedAt: string;
    endsAt: string;
    stoppedAt: string | null;
    requests: string[];
    /** 배수 · 벌칙 chosen at the start (missing on battles from before 2026-10-05 = 1배 · 없음). */
    multiplier?: number;
    penalty?: string;
  }[];
  /** 기여도 강탈: points moved from `target` to `thief` (request id = record id, so a retry returns the same spin). */
  steals?: { id: string; at: string; thief: string; target: string; slotId: string; slotLabel: string; points: number }[];
  /** 콘텐츠 시나리오 progress: plan snapshot, running part and part history (request ids dedupe 다음 부로). */
  scenario?: { parts: ScenarioPart[]; current: number | null; history: { index: number; startedAt: string; endedAt: string | null }[]; requests: string[] };
  /** 팬 메시지 · 요청사항 from the room (newest last); `userId` never leaves the server. */
  fanNotes?: { id: string; at: string; userId: string; author: string; kind: "MESSAGE" | "REQUEST"; memberId: string | null; text: string; status: "NEW" | "DONE" | "HIDDEN"; requestId: string }[];
  /** 팬 메시지 받기 꺼짐 (open by default). */
  fanNotesClosed?: boolean;
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
  /** 기여도 강탈 룰렛 slots per channel. */
  stealSlots?: Record<string, StealSlot[]>;
  /** 강탈 기준 · 쿨다운 per channel (missing = platform defaults). */
  stealRules?: Record<string, StealRules>;
  /** 팬 메시지 도배 기준 per channel (missing = platform defaults; 2026-10-06). */
  fanNoteRules?: Record<string, FanNoteRules>;
  /** 배틀 배수 · 벌칙 defaults per channel (missing = platform defaults). */
  battleRules?: Record<string, BattleRules>;
  /** 콘텐츠 시나리오 plan per channel. */
  scenario?: Record<string, ScenarioPart[]>;
  /** 직급 per channel (missing = none). */
  grades?: Record<string, CrewGrade[]>;
  /** 멤버 추가 request ids already applied (a retried add is not a second member). */
  memberRequests?: string[];
};

const m = (id: string, name: string, role: CrewMember["role"], color: string, active = true): CrewMember => ({ id, name, role, active, color });

function monthStamp(dayOffset: number) {
  const d = new Date();
  d.setDate(Math.max(1, d.getDate() - dayOffset));
  return d.toISOString();
}

const g = globalThis as typeof globalThis & { __ssumnationMockCrewV1?: MockCrew };

export const mockCrew = (g.__ssumnationMockCrewV1 ??= {
  crews: {
    [STUDIO_CHANNEL]: [m("cm-s1", "길동", "LEADER", "#8b5cf6"), m("cm-s2", "하늘", "MEMBER", "#ec4899"), m("cm-s3", "바다", "MEMBER", "#3b82f6"), m("cm-s4", "솔", "MEMBER", "#f59e0b", false)],
    c4: [m("cm-c4-1", "재형", "LEADER", "#8b5cf6"), m("cm-c4-2", "용주", "MEMBER", "#10b981"), m("cm-c4-3", "민수", "MEMBER", "#3b82f6")]
  },
  broadcasts: [
    { id: "bc-seed-c4", channelId: "c4", title: "크루 엑셀 방송", startedAt: new Date(Date.now() - 40 * 60_000).toISOString(), endedAt: null, teamMode: false, teams: {}, adjustments: [], final: null }
  ],
  attributions: [
    { donationId: "seed-1", channelId: STUDIO_CHANNEL, memberId: "cm-s2", fnAmount: 50_000, at: monthStamp(2), donor: "별빛소나타", donorId: "star_sonata", message: "하늘님 오늘 노래 최고였어요!" },
    { donationId: "seed-2", channelId: STUDIO_CHANNEL, memberId: "cm-s1", fnAmount: 30_000, at: monthStamp(3), donor: "우주비행사", donorId: "space_runner", message: "길동 리더 화이팅" },
    { donationId: "seed-3", channelId: STUDIO_CHANNEL, memberId: "cm-s3", fnAmount: 12_000, at: monthStamp(1), donor: "치즈냥", donorId: "cheese_cat", message: "바다님 리액션 귀여워요 ㅋㅋ" },
    { donationId: "seed-4", channelId: STUDIO_CHANNEL, memberId: "cm-s2", fnAmount: 8_000, at: monthStamp(0), donor: "익명", donorId: "", message: "응원합니다" }
  ]
});
