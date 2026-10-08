"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { currentRun, isEnded, mockVotes, presetItems, presetLabel, presetReady, voteBoard } from "@/services/votes/voteCore";
import type { VoteControlResult, VoteRemoteView } from "@/services/votes/voteTypes";
import { VOTE_ITEMS_MIN } from "./widgetSettingsTypes";
import { readWidget } from "./widgetStore";

/**
 * 리모컨 투표 (code-first): start a 투표 위젯 preset, end it early, take the result off the screen.
 * Votes are free (2026-10-04 결정). TBD: audit of who started and ended a vote.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Vote remote API is not connected yet.");
};

const isRequestId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);

export async function getVoteRemote(): Promise<VoteRemoteView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const settings = readWidget("VOTE");
  const run = currentRun(STUDIO_CHANNEL);
  return {
    widgetEnabled: settings.enabled,
    presets: settings.presets.map((p, i) => ({ id: p.id, label: presetLabel(p, i), color: p.color, durationSec: p.durationSec, items: presetItems(p), ready: presetReady(p) })),
    board: run ? voteBoard(run) : null
  };
}

/** Starts a preset. A retried request (same `requestId`) is a no-op; a running vote must end first. */
export async function startVote(input: unknown): Promise<VoteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { presetId?: unknown; requestId?: unknown };
  if (!isRequestId(v.requestId)) return { status: "INVALID", message: "요청 정보를 확인해 주세요." };
  if (mockVotes.runs.some((r) => r.channelId === STUDIO_CHANNEL && r.startRequestId === v.requestId)) return { status: "SAVED" };
  const presets = readWidget("VOTE").presets;
  const index = presets.findIndex((p) => p.id === v.presetId);
  if (index < 0) return { status: "INVALID", message: "투표 프리셋을 찾을 수 없어요." };
  const preset = presets[index];
  if (!presetReady(preset)) return { status: "INVALID", message: `투표 항목을 ${VOTE_ITEMS_MIN}개 이상 입력한 프리셋만 시작할 수 있어요.` };
  const now = Date.now();
  const current = currentRun(STUDIO_CHANNEL);
  if (current && !isEnded(current, now)) return { status: "INVALID", message: "진행 중인 투표를 먼저 종료해 주세요." };
  if (current) current.closedAt = new Date(now).toISOString();
  mockVotes.runs.push({
    id: `vote-${now.toString(36)}-${mockVotes.runs.length + 1}`,
    channelId: STUDIO_CHANNEL,
    presetId: preset.id,
    name: presetLabel(preset, index),
    color: preset.color,
    items: presetItems(preset),
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + preset.durationSec * 1000).toISOString(),
    endedAt: null,
    closedAt: null,
    ballots: {},
    startRequestId: v.requestId
  });
  return { status: "SAVED" };
}

const studioRun = (voteId: unknown) => mockVotes.runs.find((r) => r.channelId === STUDIO_CHANNEL && r.id === voteId) ?? null;

/** Ends the running vote now; ending an ended vote again is a no-op. */
export async function endVote(input: unknown): Promise<VoteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const run = studioRun((input as { voteId?: unknown } | null)?.voteId);
  if (!run) return { status: "INVALID", message: "투표를 찾을 수 없어요." };
  if (!isEnded(run)) run.endedAt = new Date().toISOString();
  return { status: "SAVED" };
}

/** Takes an ended vote off the overlay and the room (결과 내리기). */
export async function closeVote(input: unknown): Promise<VoteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const run = studioRun((input as { voteId?: unknown } | null)?.voteId);
  if (!run) return { status: "INVALID", message: "투표를 찾을 수 없어요." };
  if (!isEnded(run)) return { status: "INVALID", message: "투표를 먼저 종료해 주세요." };
  run.closedAt ??= new Date().toISOString();
  return { status: "SAVED" };
}
