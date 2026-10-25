import { mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun, shuffled } from "./crewGameCore";
import {
  DEFAULT_SIG_BINGO,
  SIG_BINGO_BONUS_MAX,
  SIG_BINGO_MODES,
  SIG_BINGO_REVEALS,
  SIG_BINGO_SIZES,
  sigBingoLineName,
  sigBingoLines,
  type SigBingoLive,
  type SigBingoRemaining,
  type SigBingoSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그 빙고 (server-only) — code-first, StreamDonate 시그니처 빙고 참고 (a signature game on crewGameCore). 빙고 시작 places the
 * eligible signatures on a board at random; a 시그니처 후원 opens the first closed cell of its signature (공용 판: any; 땅따먹기:
 * one sent to a member, who takes the cell). Each completed line is a 빙고 run on OBS `?sigbingo` with the 빙고 보너스 for
 * its member (공용 판: whose donation completed it; 땅따먹기: who owns the whole line). The operator can open or close cells.
 */

type StoredBoard = NonNullable<MockBroadcast["sigBingo"]>;

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const optionalPrice = (v: unknown) => v === null || v === undefined || isInt(v, 0, SIGNATURE_LIMITS.priceMax);

/** The channel's 시그 빙고 settings (defaults until saved). */
/** Settings saved before 남은 시그 목록 (2026-10-25) read with it off. */
export const sigBingoSettingsOf = (channelId: string): SigBingoSettings => ({ ...DEFAULT_SIG_BINGO, ...mockCrew.sigBingos?.[channelId] });

export function parseSigBingoSettings(input: unknown, forbidden: string[], signatureIds: string[]): SigBingoSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const size = SIG_BINGO_SIZES.find((x) => x === v.size);
  if (!size) return { message: "판 크기를 골라 주세요." };
  const mode = SIG_BINGO_MODES.find((m) => m.key === v.mode)?.key;
  const reveal = SIG_BINGO_REVEALS.find((r) => r.key === v.reveal)?.key;
  if (!mode || !reveal) return { message: "설정을 확인해 주세요." };
  if (!optionalPrice(v.priceMin) || !optionalPrice(v.priceMax)) return { message: "금액 범위를 확인해 주세요." };
  const priceMin = (v.priceMin as number | null | undefined) ?? null;
  const priceMax = (v.priceMax as number | null | undefined) ?? null;
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) return { message: "금액 범위의 최소가 최대보다 커요." };
  if (!isInt(v.bonus, 0, SIG_BINGO_BONUS_MAX)) return { message: `빙고 보너스는 0 ~ ${SIG_BINGO_BONUS_MAX.toLocaleString("ko-KR")}점이에요.` };
  // A screen from before 남은 시그 목록 sends none: off.
  if (v.showRemaining !== undefined && typeof v.showRemaining !== "boolean") return { message: "설정을 확인해 주세요." };
  return { ...common, size, mode, reveal, priceMin, priceMax, bonus: v.bonus, showRemaining: v.showRemaining === true };
}

/** The signatures a new board draws from: active, not excluded (빙고 제외 시그), within the 금액 범위. */
const eligibleOf = (s: SigBingoSettings) =>
  mockSignatures.items.filter((x) => x.active && !s.excluded.includes(x.id) && (s.priceMin === null || x.price >= s.priceMin) && (s.priceMax === null || x.price <= s.priceMax));

/**
 * 빙고 시작: a new board from the current settings — size² cells of eligible signatures in random places (each used in turn
 * when there are fewer signatures than cells). `requestId` makes a retried start a no-op. Returns an error message, or null.
 */
export function startSigBingoBoard(b: MockBroadcast, requestId: string, now = Date.now()): string | null {
  if (b.sigBingo?.requestId === requestId) return null;
  const s = sigBingoSettingsOf(b.channelId);
  const pool = eligibleOf(s);
  if (!pool.length) return "빙고판에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요.";
  const filled: typeof pool = [];
  while (filled.length < s.size * s.size) filled.push(...shuffled(pool).slice(0, s.size * s.size - filled.length));
  b.sigBingo = {
    size: s.size,
    mode: s.mode,
    reveal: s.reveal,
    startedAt: new Date(now).toISOString(),
    requestId,
    cells: shuffled(filled).map((x) => ({ signatureId: x.id, signatureName: x.name, opened: null })),
    lines: [],
    lastOpened: null
  };
  return null;
}

/** The member who owns every cell of a line (땅따먹기), or null. */
function lineOwner(board: StoredBoard, cells: number[]) {
  const first = board.cells[cells[0]].opened?.memberId ?? null;
  return first && cells.every((c) => board.cells[c].opened?.memberId === first) ? first : null;
}

/**
 * Opens a cell, then records each line through it that is now 빙고 (땅따먹기: owned by one member throughout) — a run on
 * OBS with the 빙고 보너스 for its member (none without one). `runId`: the base id of those runs.
 */
function openCell(b: MockBroadcast, index: number, opener: { memberId: string | null; donationId: string | null; manual: boolean }, runId: string, now = Date.now()) {
  const board = b.sigBingo!;
  const cell = board.cells[index];
  cell.opened = { memberId: opener.memberId, at: new Date(now).toISOString(), donationId: opener.donationId };
  board.lastOpened = index;
  const bonus = sigBingoSettingsOf(b.channelId).bonus;
  sigBingoLines(board.size).forEach((cells, line) => {
    if (board.lines.includes(line) || !cells.includes(index) || !cells.every((c) => board.cells[c].opened)) return;
    const owner = board.mode === "TERRITORY" ? lineOwner(board, cells) : opener.memberId;
    if (board.mode === "TERRITORY" && !owner) return;
    board.lines.push(line);
    const memberId = owner ?? "";
    recordRun(
      b,
      {
        id: `${runId}-${line}`,
        game: "SIG_BINGO",
        memberId,
        trigger: opener.manual ? { kind: "MANUAL" } : { kind: "SIGNATURE", signatureId: cell.signatureId, signatureName: cell.signatureName },
        sourceId: opener.donationId,
        basePoints: 0,
        itemId: cell.signatureId,
        label: `빙고! ${sigBingoLineName(board.size, line)}`,
        kind: "ADD",
        value: memberId ? bonus : 0,
        points: memberId ? bonus : 0
      },
      now
    );
  });
}

/**
 * Called for every completed donation (crewGameTriggers): while a crew broadcast is live with a board and 후원으로 칸 열기 is
 * on, a 시그니처 후원 (not excluded) opens the first closed cell of its signature — 땅따먹기 only for one sent to a member.
 */
export function sigBingoForSignature(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined }) {
  const live = liveBroadcastOf(channelId);
  const s = sigBingoSettingsOf(channelId);
  const board = live?.sigBingo;
  if (!live || !board || !s.auto || !input.signatureId || s.excluded.includes(input.signatureId)) return;
  const memberId = input.memberId && isActiveMember(channelId, input.memberId) ? input.memberId : null;
  if (board.mode === "TERRITORY" && !memberId) return;
  const index = board.cells.findIndex((c) => c.signatureId === input.signatureId && !c.opened);
  if (index >= 0) openCell(live, index, { memberId, donationId: input.donationId, manual: false }, `sigbingo-${input.donationId}`);
}

/**
 * 수동 칸 열기 · 닫기 (`open`): opening an open cell or closing a closed one is a no-op. 땅따먹기 opens a cell for a member;
 * a cell in a 빙고 line stays open. Returns an error message, or null.
 */
export function setSigBingoCell(b: MockBroadcast, input: { index: unknown; open: unknown; memberId: unknown }, now = Date.now()): string | null {
  const board = b.sigBingo;
  if (!board) return "빙고를 먼저 시작해 주세요.";
  if (!isInt(input.index, 0, board.cells.length - 1) || typeof input.open !== "boolean") return "칸을 다시 골라 주세요.";
  const cell = board.cells[input.index];
  if (!input.open) {
    if (!cell.opened) return null;
    if (board.lines.some((line) => sigBingoLines(board.size)[line].includes(input.index as number))) return "빙고 줄에 들어간 칸은 닫을 수 없어요.";
    cell.opened = null;
    if (board.lastOpened === input.index) board.lastOpened = null;
    return null;
  }
  if (cell.opened) return null;
  const memberId = typeof input.memberId === "string" && isActiveMember(b.channelId, input.memberId) ? input.memberId : null;
  if (board.mode === "TERRITORY" && !memberId) return "땅따먹기에서는 칸을 차지할 멤버를 골라 주세요.";
  openCell(b, input.index, { memberId, donationId: null, manual: true }, `sigbingo-m${now.toString(36)}-${input.index}`, now);
  return null;
}

/** 판 비우기: the board goes away (빙고 시작 makes a new one). */
export function clearSigBingoBoard(b: MockBroadcast) {
  delete b.sigBingo;
}

/** 남은 시그: the closed cells of the board by signature, cheapest first (a deleted signature keeps the name on its cell). */
function remainingOf(board: StoredBoard | undefined): SigBingoRemaining[] {
  const by = new Map<string, SigBingoRemaining>();
  for (const c of board?.cells ?? []) {
    if (c.opened) continue;
    const row = by.get(c.signatureId) ?? { signatureId: c.signatureId, name: c.signatureName, price: mockSignatures.items.find((x) => x.id === c.signatureId)?.price ?? 0, cells: 0 };
    row.cells += 1;
    by.set(c.signatureId, row);
  }
  return [...by.values()].sort((x, y) => x.price - y.price || x.name.localeCompare(y.name));
}

export function sigBingoLive(b: MockBroadcast): SigBingoLive {
  const s = sigBingoSettingsOf(b.channelId);
  const crew = mockCrew.crews[b.channelId] ?? [];
  const board = b.sigBingo;
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "SIG_BINGO"),
    eligible: eligibleOf(s).length,
    remaining: remainingOf(board),
    board: board
      ? {
          size: board.size,
          mode: board.mode,
          reveal: board.reveal,
          startedAt: board.startedAt,
          lines: [...board.lines],
          lastOpened: board.lastOpened,
          cells: board.cells.map((c) => {
            const sig = mockSignatures.items.find((x) => x.id === c.signatureId);
            const m = c.opened?.memberId ? crew.find((x) => x.id === c.opened!.memberId) : undefined;
            return {
              signatureId: c.signatureId,
              signatureName: c.signatureName,
              imageUrl: sig ? signatureImageOf(sig) : null,
              opened: c.opened && { memberName: m?.name ?? (c.opened.memberId ? "삭제된 멤버" : null), memberColor: m?.color ?? null, at: c.opened.at, manual: c.opened.donationId === null }
            };
          })
        }
      : null
  };
}
