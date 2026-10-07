"use server";

import { USE_MOCK } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { getCreatorById } from "@/services/creators/creators";
import { blocksOf, moderationStore, resolveTarget } from "./moderationCore";
import { REPORT_DETAIL_MAX, REPORT_REASONS, type BlockEntry, type BlockResult, type ReportReason, type ReportResult, type ReportTarget, type ReportTargetType } from "./moderationTypes";

/**
 * 신고 · 차단 Server Actions — code-first. Members report content (one report per member and target)
 * and block authors; blocked authors' posts, comments and mail disappear for the blocker. Operators
 * review reports in the admin app (`/api/admin/reports`).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Moderation API is not connected yet.");
};
const TYPES: ReportTargetType[] = ["POST", "COMMENT", "CHANNEL_POST", "MESSAGE", "CREATOR"];

function parseTarget(v: Record<string, unknown>): ReportTarget | null {
  if (!TYPES.includes(v.type as ReportTargetType) || typeof v.id !== "string" || !v.id || v.id.length > 80) return null;
  if (v.type === "COMMENT" && (typeof v.parentId !== "string" || !v.parentId)) return null;
  return { type: v.type as ReportTargetType, id: v.id, ...(v.type === "COMMENT" ? { parentId: v.parentId as string } : {}) };
}
const obj = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const keyOf = (t: ReportTarget) => `${t.type}:${t.parentId ?? ""}:${t.id}`;

export async function submitReport(input: unknown): Promise<ReportResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  const target = parseTarget(obj(v.target));
  if (!target) return { status: "INVALID", message: "신고할 대상을 확인해 주세요." };
  if (!REPORT_REASONS.some((r) => r.key === v.reason)) return { status: "INVALID", message: "신고 사유를 골라 주세요." };
  const detail = typeof v.detail === "string" ? v.detail.trim() : "";
  if (detail.length > REPORT_DETAIL_MAX) return { status: "INVALID", message: `상세 내용은 ${REPORT_DETAIL_MAX}자까지예요.` };
  if (v.reason === "ETC" && !detail) return { status: "INVALID", message: "기타 사유는 내용을 적어 주세요." };
  const resolved = await resolveTarget(target, getCreatorById);
  if (!resolved) return { status: "NOT_FOUND" };
  if (resolved.authorId === session.userId) return { status: "INVALID", message: "내가 쓴 내용은 신고할 수 없어요." };
  const store = moderationStore();
  // One open report per member and target: repeats are acknowledged without piling up.
  const dedupe = `${session.userId}|${keyOf(target)}`;
  if (store.requests[dedupe]) return { status: "ALREADY_REPORTED" };
  const now = new Date();
  const id = `rp-${now.getTime().toString(36)}-${store.reports.length}`;
  store.reports.push({
    id,
    target,
    authorId: resolved.authorId,
    authorName: resolved.authorName,
    snapshot: resolved.snapshot,
    reason: v.reason as ReportReason,
    detail,
    reporterId: session.userId,
    reporterName: session.nickname,
    createdAt: now.toISOString(),
    status: "OPEN",
    resolution: null
  });
  store.requests[dedupe] = id;
  return { status: "REPORTED" };
}

/** Blocks the author of a piece of content (the author id never leaves the server). */
export async function blockAuthorOf(input: unknown): Promise<BlockResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const target = parseTarget(obj(obj(input).target));
  // A channel is reported, not blocked (the room offers no 차단 for it).
  if (!target || target.type === "CREATOR") return { status: "INVALID", message: "차단할 대상을 확인해 주세요." };
  const resolved = await resolveTarget(target, getCreatorById);
  if (!resolved) return { status: "NOT_FOUND" };
  if (resolved.authorId === session.userId) return { status: "INVALID", message: "나 자신은 차단할 수 없어요." };
  const store = moderationStore();
  const mine = (store.blocks[session.userId] ??= {});
  mine[resolved.authorId] ??= { id: resolved.authorId, name: resolved.authorName, since: new Date().toISOString() };
  return { status: "OK", name: resolved.authorName };
}

export async function unblock(id: unknown): Promise<BlockResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const mine = moderationStore().blocks[session.userId] ?? {};
  const entry = typeof id === "string" ? mine[id] : undefined;
  if (!entry) return { status: "NOT_FOUND" };
  delete mine[entry.id];
  return { status: "OK", name: entry.name };
}

export async function listBlocks(): Promise<BlockEntry[] | null> {
  assertMock();
  const session = await getSession();
  if (!session) return null;
  return Object.values(blocksOf(session.userId)).sort((a, b) => b.since.localeCompare(a.since));
}
