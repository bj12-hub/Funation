import { mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_SIG_DOSAN,
  SIG_DOSAN_BONUS_MAX,
  SIG_DOSAN_DISPLAYS,
  SIG_DOSAN_MODES,
  SIG_DOSAN_STEPS_MAX,
  SIG_DOSAN_STEPS_MIN,
  type SigDosanLive,
  type SigDosanSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그니처 두산 (server-only) — code-first, StreamDonate 시그니처 두산 참고 (a signature game on crewGameCore). 두산 시작 lines
 * the picked signatures up from the lowest price (the ladder). A 시그니처 후원 of a lane's next step shoots that lane up one
 * (전체: any donation · VS: one to a member of A팀 / B팀 · 개인전: one to a member, for their own lane); each step is a run on
 * OBS `?sigdosan`. The first lane to the top wins — its last step is the 완주 run, with the 완주 보너스 for its member — and
 * nothing climbs after it. The operator can move a lane up or down a step.
 */

type StoredBoard = NonNullable<MockBroadcast["sigDosan"]>;
type Opener = Pick<StoredRun, "trigger" | "sourceId"> & { memberId: string | null };

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const signatureOf = (id: string) => mockSignatures.items.find((x) => x.id === id);

/** The channel's 시그니처 두산 settings (defaults until saved; settings from before 표시 방식 read with the 롤러). */
export const sigDosanSettingsOf = (channelId: string): SigDosanSettings => ({ ...DEFAULT_SIG_DOSAN, ...mockCrew.sigDosans?.[channelId] });

export function parseSigDosanSettings(input: unknown, forbidden: string[], signatureIds: string[]): SigDosanSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const mode = SIG_DOSAN_MODES.find((m) => m.key === v.mode)?.key;
  if (!mode) return { message: "설정을 확인해 주세요." };
  if (!Array.isArray(v.signatureIds) || v.signatureIds.some((id) => typeof id !== "string" || !signatureIds.includes(id))) return { message: "두산 시그니처를 확인해 주세요." };
  const picked = [...new Set(v.signatureIds as string[])];
  if (picked.length > SIG_DOSAN_STEPS_MAX) return { message: `두산 시그니처는 ${SIG_DOSAN_STEPS_MAX}개까지 고를 수 있어요.` };
  if (!isInt(v.bonus, 0, SIG_DOSAN_BONUS_MAX)) return { message: `완주 보너스는 0 ~ ${SIG_DOSAN_BONUS_MAX.toLocaleString("ko-KR")}점이에요.` };
  // A screen from before 표시 방식 sends none: the 롤러.
  const display = v.display === undefined ? "ROLLER" : SIG_DOSAN_DISPLAYS.find((d) => d.key === v.display)?.key;
  if (!display) return { message: "OBS 표시 방식을 골라 주세요." };
  return { ...common, mode, signatureIds: picked, bonus: v.bonus, display };
}

/** The ladder from the picked signatures in use: the lowest price first (the same price in the picked order). */
export const sigDosanLadder = (s: SigDosanSettings) =>
  s.signatureIds
    .map(signatureOf)
    .filter((x) => !!x && x.active)
    .sort((x, y) => x!.price - y!.price)
    .map((x) => x!.id);

/**
 * 두산 시작: a new board from the saved settings — VS only in a team broadcast. `requestId` makes a retried start a no-op.
 * Returns an error message, or null.
 */
export function startSigDosanBoard(b: MockBroadcast, requestId: string, now = Date.now()): string | null {
  if (b.sigDosan?.requestId === requestId) return null;
  const s = sigDosanSettingsOf(b.channelId);
  const ladder = sigDosanLadder(s);
  if (ladder.length < SIG_DOSAN_STEPS_MIN) return `두산에 쓸 시그니처를 ${SIG_DOSAN_STEPS_MIN}개 이상 골라 주세요(사용 중인 시그니처만 들어가요).`;
  if (s.mode === "VS" && !b.teamMode) return "VS는 팀 배틀 방송에서만 할 수 있어요.";
  b.sigDosan = { requestId, startedAt: new Date(now).toISOString(), mode: s.mode, ladder, lanes: {}, winner: null };
  return null;
}

/** The lanes of the board: 전체 one, VS the two teams, 개인전 the active members (and anyone who climbed since). */
function laneKeys(b: MockBroadcast, board: StoredBoard): string[] {
  if (board.mode === "ALL") return ["ALL"];
  if (board.mode === "VS") return ["A", "B"];
  const crew = mockCrew.crews[b.channelId] ?? [];
  return crew.filter((m) => m.active || board.lanes[m.id]?.length).map((m) => m.id);
}

function laneLabel(b: MockBroadcast, key: string) {
  if (key === "ALL") return "전체";
  if (key === "A" || key === "B") return `${key}팀`;
  return (mockCrew.crews[b.channelId] ?? []).find((m) => m.id === key)?.name ?? "삭제된 멤버";
}

/** The lane a donation to `memberId` (or none) climbs: 전체 any, VS the member's team, 개인전 the member's own — or none. */
function laneOf(b: MockBroadcast, board: StoredBoard, memberId: string | null): string | null {
  if (board.mode === "ALL") return "ALL";
  if (!memberId) return null;
  return board.mode === "VS" ? (b.teams[memberId] ?? null) : memberId;
}

/** Climbs a lane one step and records the run; the last step is the 완주 (보너스 for its member), and the board is won. */
function climb(b: MockBroadcast, board: StoredBoard, lane: string, opener: Opener, runId: string, now: number) {
  const steps = (board.lanes[lane] ??= []);
  const signatureId = board.ladder[steps.length];
  const name = signatureOf(signatureId)?.name ?? "시그니처";
  const n = steps.length + 1;
  const done = n === board.ladder.length;
  const team = board.mode === "VS" ? `${lane}팀 ` : "";
  const bonus = done && opener.memberId ? sigDosanSettingsOf(b.channelId).bonus : 0;
  const label = !done ? `${team}${n}단 · ${name}` : board.mode === "VS" ? `${team}완주! 승리` : board.mode === "SOLO" ? "완주! 1등" : "완주!";
  const run = recordRun(
    b,
    { id: runId, game: "SIG_DOSAN", memberId: opener.memberId ?? "", trigger: opener.trigger, sourceId: opener.sourceId, basePoints: 0, itemId: signatureId, label, kind: bonus ? "ADD" : "TEXT", value: bonus, points: bonus },
    now
  );
  steps.push({ memberId: opener.memberId, at: run.at, revealAt: run.revealAt, donationId: opener.sourceId });
  if (done) board.winner = { lane, memberId: opener.memberId, revealAt: run.revealAt };
}

/**
 * Called for every completed donation (crewGameTriggers): while a crew broadcast is live with a board nobody has won and
 * 시그니처 후원으로 올리기 is on, a 시그니처 후원 of its lane's next step (전체: any; VS: to a member of a team; 개인전: to a
 * member) climbs that lane.
 */
export function sigDosanForSignature(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined }, now = Date.now()) {
  const live = liveBroadcastOf(channelId);
  const board = live?.sigDosan;
  if (!live || !board || board.winner || !sigDosanSettingsOf(channelId).auto || !input.signatureId) return;
  const runId = `sigdosan-${input.donationId}`;
  if ((live.gameRuns ?? []).some((r) => r.id === runId)) return;
  const memberId = input.memberId && isActiveMember(channelId, input.memberId) ? input.memberId : null;
  const lane = laneOf(live, board, memberId);
  if (!lane || board.ladder[board.lanes[lane]?.length ?? 0] !== input.signatureId) return;
  const signatureName = signatureOf(input.signatureId)?.name ?? "시그니처";
  climb(live, board, lane, { memberId, trigger: { kind: "SIGNATURE", signatureId: input.signatureId, signatureName }, sourceId: input.donationId }, runId, now);
}

/**
 * 수동: `up` climbs `lane` a step (for `memberId` — 개인전: the lane's own member; VS: one of that team — or none; `requestId`
 * is the run id, so a retry climbs no more); down takes its last step off while nobody has won (`count`: the lane's steps as
 * seen, so a retry takes off no more). Returns an error message, or null.
 */
export function stepSigDosanLane(b: MockBroadcast, input: { lane: unknown; up: unknown; memberId: unknown; count: unknown; requestId: string }, now = Date.now()): string | null {
  const board = b.sigDosan;
  if (!board) return "두산을 먼저 시작해 주세요.";
  if (typeof input.lane !== "string" || !laneKeys(b, board).includes(input.lane) || typeof input.up !== "boolean") return "줄을 다시 골라 주세요.";
  const lane = input.lane;
  const steps = board.lanes[lane] ?? [];
  if (!input.up) {
    if (input.count !== steps.length || !steps.length) return null;
    if (board.winner) return "완주한 판은 되돌릴 수 없어요.";
    steps.pop();
    return null;
  }
  const runId = `sigdosan-m-${input.requestId}`;
  if ((b.gameRuns ?? []).some((r) => r.id === runId)) return null;
  if (board.winner) return "이미 완주했어요. 처음부터 다시 시작해 주세요.";
  let memberId = typeof input.memberId === "string" && isActiveMember(b.channelId, input.memberId) ? input.memberId : null;
  if (board.mode === "SOLO") {
    if (!isActiveMember(b.channelId, lane)) return "활동 중인 멤버의 줄만 올릴 수 있어요.";
    memberId = lane;
  }
  if (board.mode === "VS" && memberId && b.teams[memberId] !== lane) return `${laneLabel(b, lane)} 멤버를 골라 주세요.`;
  climb(b, board, lane, { memberId, trigger: { kind: "MANUAL" }, sourceId: null }, runId, now);
  return null;
}

/** 판 비우기: the board goes away (두산 시작 makes a new one). */
export function clearSigDosanBoard(b: MockBroadcast) {
  delete b.sigDosan;
}

export function sigDosanLive(b: MockBroadcast): SigDosanLive {
  const crew = mockCrew.crews[b.channelId] ?? [];
  const member = (id: string | null) => (id ? crew.find((m) => m.id === id) : undefined);
  const nameOf = (id: string | null) => (id ? (member(id)?.name ?? "삭제된 멤버") : null);
  const board = b.sigDosan;
  return {
    settings: structuredClone(sigDosanSettingsOf(b.channelId)),
    runs: gameRunsView(b, "SIG_DOSAN"),
    board: board
      ? {
          mode: board.mode,
          startedAt: board.startedAt,
          ladder: board.ladder.map((id) => {
            const sig = signatureOf(id);
            return { signatureId: id, signatureName: sig?.name ?? "삭제된 시그니처", price: sig?.price ?? 0, imageUrl: sig ? signatureImageOf(sig) : null };
          }),
          lanes: laneKeys(b, board).map((key) => ({
            key,
            label: laneLabel(b, key),
            color: board.mode === "SOLO" ? (member(key)?.color ?? null) : null,
            steps: (board.lanes[key] ?? []).map((x) => ({ memberName: nameOf(x.memberId), memberColor: member(x.memberId)?.color ?? null, at: x.at, revealAt: x.revealAt, manual: x.donationId === null }))
          })),
          winner: board.winner && { lane: board.winner.lane, label: laneLabel(b, board.winner.lane), memberName: nameOf(board.winner.memberId), revealAt: board.winner.revealAt }
        }
      : null
  };
}
