import { toDateString } from "@/lib/period";
import { mockAccount } from "@/services/account/mockStore";
import type { QuestStatus } from "@/services/creator/donationManagementTypes";
import { FIXTURE_AMOUNTS, FIXTURE_DONORS, QUEST_TITLES } from "@/services/creator/receivedFixtures";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { notify } from "@/services/notifications/notificationCore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import type { QuestAction, QuestDecideResult } from "./questTypes";

/**
 * Server-only quest records (not a "use server" module). A 퀘스트 후원 holds the full amount from the
 * moment it is sent; the decision settles it: SUCCESS keeps it with the creator, FAILED or CANCELED
 * (creator only) refunds all of it to the supporter (2026-10-04 결정). A result never changes once decided,
 * and a quest past its time limit keeps running until someone decides (2026-10-04 결정).
 */

export type QuestDecider = "CREATOR" | "DONOR";

export type QuestRecord = {
  /** The donation id (same as the supporter's 후원 내역 row). */
  id: string;
  channelId: string;
  /** Who sent it (null for the studio's fictional sample donors). */
  supporterUserId: string | null;
  donor: string;
  /** Empty for a hidden profile. */
  donorId: string;
  title: string;
  /** FN held when the quest was sent (= 성공 보상). */
  amount: number;
  timeLimitSec: number;
  /** "크리에이터 성공 결정": the creator may decide too (the supporter always may). */
  creatorDecides: boolean;
  createdAt: string;
  status: QuestStatus;
  decidedAt: string | null;
  decidedBy: QuestDecider | null;
  /** FN returned to the supporter (the whole amount when FAILED or CANCELED). */
  refundedFn: number;
};

const STATUS_CYCLE: QuestStatus[] = ["SUCCESS", "SUCCESS", "FAILED"];

/** The studio's quest history: 36 quests over ~14 months; the two newest started minutes ago. */
function seedQuests(now = Date.now()): QuestRecord[] {
  return Array.from({ length: 36 }, (_, i) => {
    const [donor, donorId] = FIXTURE_DONORS[i % FIXTURE_DONORS.length];
    const running = i < 2;
    const created = running ? now - (i + 1) * 3 * 60_000 : now - Math.round(i * i * 0.35 * 86_400_000 + i * 3_700_000);
    const status: QuestStatus = running ? "IN_PROGRESS" : STATUS_CYCLE[i % STATUS_CYCLE.length];
    const amount = FIXTURE_AMOUNTS[i % FIXTURE_AMOUNTS.length];
    return {
      id: `q${i + 1}`,
      channelId: STUDIO_CHANNEL,
      supporterUserId: null,
      donor,
      donorId,
      title: QUEST_TITLES[i % QUEST_TITLES.length],
      amount,
      timeLimitSec: running ? (i === 0 ? 600 : 1_800) : 600,
      creatorDecides: true,
      createdAt: new Date(created).toISOString(),
      status,
      decidedAt: running ? null : new Date(created + 300_000).toISOString(),
      decidedBy: running ? null : "CREATOR",
      refundedFn: status === "FAILED" ? amount : 0
    };
  });
}

const g = globalThis as typeof globalThis & { __funationMockQuestsV1?: { items: QuestRecord[] } };
export const mockQuests = (g.__funationMockQuestsV1 ??= { items: seedQuests() });

export const findQuest = (id: unknown) => (typeof id === "string" ? (mockQuests.items.find((q) => q.id === id) ?? null) : null);

/** Called by the Donation Core after a completed 퀘스트 후원. */
export function recordQuest(input: Omit<QuestRecord, "status" | "decidedAt" | "decidedBy" | "refundedFn">) {
  mockQuests.items.unshift({ ...input, status: "IN_PROGRESS", decidedAt: null, decidedBy: null, refundedFn: 0 });
}

/**
 * Settles a quest once. Deciding again with the same outcome returns the same result (retry-safe);
 * the other outcome is refused. The caller has already checked who may decide.
 */
export function decideQuest(q: QuestRecord, outcome: QuestAction, by: QuestDecider, now = new Date()): QuestDecideResult {
  if (q.status !== "IN_PROGRESS") {
    return q.status === outcome ? { status: "OK", questStatus: q.status, refundedFn: q.refundedFn } : { status: "ALREADY_DECIDED", questStatus: q.status };
  }
  q.status = outcome;
  q.decidedAt = now.toISOString();
  q.decidedBy = by;
  if (outcome === "FAILED" || outcome === "CANCELED") refund(q, now);
  return { status: "OK", questStatus: q.status, refundedFn: q.refundedFn };
}

/** 퀘스트 실패 · 취소 = 후원 금액 전액 환불. In mock mode the wallet is the signed-in member's own. */
function refund(q: QuestRecord, now: Date) {
  q.refundedFn = q.amount;
  const record = mockWallet.donations.find((d) => d.id === q.id);
  if (!record || record.status !== "COMPLETED") return;
  record.status = "REFUNDED";
  record.refundedAt = `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`;
  mockAccount.fnBalance += q.amount;
  notify({
    kind: "REFUND",
    title: q.status === "CANCELED" ? "퀘스트가 취소돼 환불됐어요" : "퀘스트 후원이 환불됐어요",
    body: `${q.title} · ${q.amount.toLocaleString("ko-KR")} FN`,
    href: "/wallet/donations?type=quest",
    dedupeKey: `quest-refund:${q.id}`
  });
}
