import { randomInt, randomUUID } from "node:crypto";
import { mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun, shuffled, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_GRID_DRAW,
  GAME_TIMING,
  GRID_DRAW_LABEL_MAX,
  GRID_DRAW_POINTS_MAX,
  GRID_DRAW_PRIZES_MAX,
  GRID_DRAW_SIZES,
  GRID_DRAW_TRIGGERS,
  GRID_PRIZE_KINDS,
  type GridDrawLive,
  type GridDrawSettings,
  type GridPrize
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 복불복 뽑기판 (server-only) — code-first, StreamDonate 복불복 뽑기판 참고 (a game on crewGameCore). 뽑기판 시작 hides the
 * 당첨 항목 (문구 · 시그니처 · 점수) and 꽝 in random cells; a donation (시그니처 후원만 or 모든 후원, from a 최소 금액) opens a
 * random closed cell, the operator opens any. Each opening is a run on OBS `?griddraw` — a 점수 prize for the opener's
 * member. When every cell is open the board starts over once its last result has played (모든 칸 오픈 시 자동 리셋).
 */

type StoredBoard = NonNullable<MockBroadcast["gridDraw"]>;

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 복불복 뽑기판 settings (defaults until saved). */
export const gridDrawSettingsOf = (channelId: string): GridDrawSettings => mockCrew.gridDraws?.[channelId] ?? DEFAULT_GRID_DRAW;

/**
 * Validates the settings: 당첨 항목 fit the board (their cells add up to at most size²; the rest are 꽝). A SIGNATURE prize
 * takes the signature's name. `knownPrizes`: the saved prize ids (kept); any other id is replaced.
 */
export function parseGridDrawSettings(input: unknown, forbidden: string[], signatureIds: string[], knownPrizes: string[]): GridDrawSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const size = GRID_DRAW_SIZES.find((x) => x === v.size);
  if (!size) return { message: "칸 개수를 골라 주세요." };
  const trigger = GRID_DRAW_TRIGGERS.find((t) => t.key === v.trigger)?.key;
  if (!trigger || typeof v.autoReset !== "boolean") return { message: "설정을 확인해 주세요." };
  if (!isInt(v.minAmount, 0, SIGNATURE_LIMITS.priceMax)) return { message: "최소 금액을 확인해 주세요." };
  if (!Array.isArray(v.prizes) || v.prizes.length > GRID_DRAW_PRIZES_MAX) return { message: `당첨 항목은 ${GRID_DRAW_PRIZES_MAX}개까지 만들 수 있어요.` };
  const cells = size * size;
  const prizes: GridPrize[] = [];
  for (const raw of v.prizes) {
    const p = rec(raw);
    const kind = GRID_PRIZE_KINDS.find((k) => k.key === p.kind)?.key;
    if (!kind) return { message: "당첨 종류를 골라 주세요." };
    if (!isInt(p.count, 1, cells)) return { message: `당첨 칸 수는 1 ~ ${cells}칸이에요.` };
    let label = typeof p.label === "string" ? p.label.trim() : "";
    let signatureId: string | null = null;
    if (kind === "SIGNATURE") {
      const sig = typeof p.signatureId === "string" && signatureIds.includes(p.signatureId) ? mockSignatures.items.find((x) => x.id === p.signatureId) : undefined;
      if (!sig) return { message: "당첨 시그니처를 골라 주세요." };
      signatureId = sig.id;
      label = sig.name;
    } else {
      if (!label || label.length > GRID_DRAW_LABEL_MAX) return { message: `당첨 문구는 1~${GRID_DRAW_LABEL_MAX}자로 입력해 주세요.` };
      // 문구 are shown on stream.
      if (forbidden.some((w) => label.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    }
    if (kind === "POINTS" && !isInt(p.points, 1, GRID_DRAW_POINTS_MAX)) return { message: `점수는 1 ~ ${GRID_DRAW_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
    const keep = typeof p.id === "string" && knownPrizes.includes(p.id) && !prizes.some((x) => x.id === p.id);
    prizes.push({ id: keep ? (p.id as string) : `gp-${randomUUID().slice(0, 8)}`, kind, label, signatureId, points: kind === "POINTS" ? (p.points as number) : 0, count: p.count });
  }
  const used = prizes.reduce((s, p) => s + p.count, 0);
  if (used > cells) return { message: `당첨 칸(${used}칸)이 전체 칸(${cells}칸)보다 많아요.` };
  return { ...common, size, trigger, minAmount: v.minAmount, autoReset: v.autoReset, prizes };
}

/** A new board: each prize in its cells, 꽝 in the rest, all in random places (server randomness). */
function newBoard(s: GridDrawSettings, requestId: string, round: number, now: number): StoredBoard {
  const prizes = s.prizes.flatMap((p) => Array.from({ length: p.count }, () => ({ kind: p.kind, label: p.label, signatureId: p.signatureId, points: p.points, opened: null })));
  const misses = Array.from({ length: s.size * s.size - prizes.length }, () => ({ kind: "MISS" as const, label: "꽝", signatureId: null, points: 0, opened: null }));
  return { size: s.size, round, startedAt: new Date(now).toISOString(), requestId, cells: shuffled([...prizes, ...misses]), lastOpened: null, resetAt: null };
}

/** 뽑기판 시작: a new board from the saved settings (replacing the one there). `requestId` makes a retried start a no-op. */
export function startGridDrawBoard(b: MockBroadcast, requestId: string, now = Date.now()) {
  if (b.gridDraw?.requestId === requestId) return;
  b.gridDraw = newBoard(gridDrawSettingsOf(b.channelId), requestId, 1, now);
}

/**
 * 자동 리셋: a full board stays (OBS plays its last result) until its `resetAt`, then the next board — from the settings saved
 * by then — replaces it. `opening`: a new opening does not wait. Returns the current board.
 */
export function settleGridDraw(b: MockBroadcast, now = Date.now(), opening = false): StoredBoard | undefined {
  const board = b.gridDraw;
  if (board?.resetAt && (opening || now >= Date.parse(board.resetAt))) b.gridDraw = newBoard(gridDrawSettingsOf(b.channelId), board.requestId, board.round + 1, now);
  return b.gridDraw;
}

/** Opens a cell and records the run (a 점수 prize adds points only for a member — else it shows as a 문구); with 자동 리셋 a full board gets its `resetAt`. */
function openCell(b: MockBroadcast, board: StoredBoard, index: number, opener: Pick<StoredRun, "memberId" | "trigger" | "sourceId">, runId: string, now: number) {
  const cell = board.cells[index];
  const points = cell.kind === "POINTS" && opener.memberId ? cell.points : 0;
  const run = recordRun(
    b,
    { ...opener, id: runId, game: "GRID_DRAW", basePoints: 0, itemId: cell.signatureId, label: cell.label, kind: points ? "ADD" : cell.kind === "MISS" ? "MISS" : "TEXT", value: points, points },
    now
  );
  cell.opened = { memberId: opener.memberId || null, at: run.at, revealAt: run.revealAt, donationId: opener.sourceId };
  board.lastOpened = index;
  if (gridDrawSettingsOf(b.channelId).autoReset && board.cells.every((c) => c.opened)) {
    board.resetAt = new Date(Date.parse(run.revealAt) + GAME_TIMING.GRID_DRAW.resultSec * 1000).toISOString();
  }
}

const closedCells = (board: StoredBoard) => board.cells.flatMap((c, i) => (c.opened ? [] : [i]));

/**
 * Called for every completed donation (crewGameTriggers): while a crew broadcast is live with a board and 후원 시 자동 랜덤
 * 오픈 is on, a donation of the 최소 금액 or more (a 시그니처 후원 not excluded, or on 모든 후원 any donation) opens a random
 * closed cell — for the member the supporter picked, or none.
 */
export function gridDrawForDonation(
  channelId: string,
  input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number },
  now = Date.now()
) {
  const live = liveBroadcastOf(channelId);
  const s = gridDrawSettingsOf(channelId);
  if (!live?.gridDraw || !s.auto || input.fnAmount < s.minAmount) return;
  if ((s.trigger === "SIGNATURE" && !input.signatureId) || (input.signatureId && s.excluded.includes(input.signatureId))) return;
  const runId = `griddraw-${input.donationId}`;
  if ((live.gameRuns ?? []).some((r) => r.id === runId)) return;
  const board = settleGridDraw(live, now, true)!;
  const closed = closedCells(board);
  if (!closed.length) return;
  const memberId = input.memberId && isActiveMember(channelId, input.memberId) ? input.memberId : "";
  const signatureName = input.signatureId ? (mockSignatures.items.find((x) => x.id === input.signatureId)?.name ?? "시그니처") : null;
  openCell(
    live,
    board,
    closed[randomInt(closed.length)],
    {
      memberId,
      trigger: input.signatureId && signatureName ? { kind: "SIGNATURE", signatureId: input.signatureId, signatureName } : { kind: "DONATION", amount: input.fnAmount },
      sourceId: input.donationId
    },
    runId,
    now
  );
}

/**
 * 수동 열기: a chosen closed cell of board `round`, or a random closed one (`index` null), for a member or none. `requestId`
 * is the run id, so a retry opens nothing more. Returns an error message, or null.
 */
export function openGridDrawCell(b: MockBroadcast, input: { index: unknown; round: unknown; memberId: unknown; requestId: string }, now = Date.now()): string | null {
  const runId = `griddraw-m-${input.requestId}`;
  if ((b.gameRuns ?? []).some((r) => r.id === runId)) return null;
  const random = input.index === null || input.index === undefined;
  const board = settleGridDraw(b, now, random);
  if (!board) return "뽑기판을 먼저 시작해 주세요.";
  let index: number;
  if (random) {
    const closed = closedCells(board);
    if (!closed.length) return "열 칸이 없어요. 새 판으로 다시 시작해 주세요.";
    index = closed[randomInt(closed.length)];
  } else {
    // A cell picked on a board that has since been replaced (자동 리셋 · 다시 시작) is not this board's cell.
    if (input.round !== board.round) return "판이 바뀌었어요. 칸을 다시 골라 주세요.";
    if (!isInt(input.index, 0, board.cells.length - 1)) return "칸을 다시 골라 주세요.";
    if (board.cells[input.index].opened) return "이미 열린 칸이에요.";
    index = input.index;
  }
  const memberId = typeof input.memberId === "string" && isActiveMember(b.channelId, input.memberId) ? input.memberId : "";
  openCell(b, board, index, { memberId, trigger: { kind: "MANUAL" }, sourceId: null }, runId, now);
  return null;
}

/** 판 비우기: the board goes away (뽑기판 시작 makes a new one). */
export function clearGridDrawBoard(b: MockBroadcast) {
  delete b.gridDraw;
}

/**
 * The board as shown (a full board past its `resetAt` is replaced first): `reveal` false (OBS) leaves closed cells' prizes
 * out (and the prize list); the studio passes true.
 */
export function gridDrawLive(b: MockBroadcast, reveal: boolean, now = Date.now()): GridDrawLive {
  const crew = mockCrew.crews[b.channelId] ?? [];
  const board = settleGridDraw(b, now);
  const settings = structuredClone(gridDrawSettingsOf(b.channelId));
  return {
    settings: reveal ? settings : { ...settings, prizes: [] },
    runs: gameRunsView(b, "GRID_DRAW"),
    board: board
      ? {
          size: board.size,
          round: board.round,
          startedAt: board.startedAt,
          lastOpened: board.lastOpened,
          resetAt: board.resetAt,
          cells: board.cells.map((c) => {
            if (!c.opened && !reveal) return { kind: "HIDDEN", label: "", imageUrl: null, points: 0, opened: null };
            const sig = c.signatureId ? mockSignatures.items.find((x) => x.id === c.signatureId) : undefined;
            const m = c.opened?.memberId ? crew.find((x) => x.id === c.opened!.memberId) : undefined;
            return {
              kind: c.kind,
              label: c.label,
              imageUrl: sig ? signatureImageOf(sig) : null,
              points: c.points,
              opened: c.opened && {
                memberName: m?.name ?? (c.opened.memberId ? "삭제된 멤버" : null),
                memberColor: m?.color ?? null,
                at: c.opened.at,
                revealAt: c.opened.revealAt,
                manual: c.opened.donationId === null
              }
            };
          })
        }
      : null
  };
}
