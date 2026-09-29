import type { CrewMember } from "./crewTypes";

/**
 * Development-only crew state, keyed by channel id: the studio creator's own channel
 * (`STUDIO_CHANNEL`) and one room creator (c4) so member targeting can be tried in a creator room.
 * `attributions` records which member a completed donation was sent for. Seed amounts give the
 * studio ranking some rows; they did not debit anyone.
 */

export const STUDIO_CHANNEL = "studio";

type Attribution = { donationId: string; channelId: string; memberId: string; fnAmount: number; at: string };

type MockCrew = {
  crews: Record<string, CrewMember[]>;
  attributions: Attribution[];
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
