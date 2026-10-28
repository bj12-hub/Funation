import { mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun, shuffled } from "./crewGameCore";
import {
  DEFAULT_SIG_BINGO,
  MULTI_TEAM_COLORS,
  SIG_BINGO_BONUS_MAX,
  SIG_BINGO_MODES,
  SIG_BINGO_REVEALS,
  SIG_BINGO_SIZES,
  sigBingoLineName,
  sigBingoLines,
  type SigBingoGrid,
  type SigBingoLive,
  type SigBingoMode,
  type SigBingoRemaining,
  type SigBingoSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그 빙고 (server-only) — code-first, StreamDonate 시그니처 빙고 참고 (a signature game on crewGameCore). 빙고 시작 places the
 * eligible signatures at random on the mode's boards: one (공용 판 · 땅따먹기), A팀 · B팀's (BJ(팀), 팀 배틀 방송) or one per
 * active member (BJ(개인)), each laid out on its own. A 시그니처 후원 opens the first closed cell of its signature on the board
 * it goes to (공용 판: any; 땅따먹기: one sent to a member, who takes the cell; BJ(팀): one sent to a member, on their team's;
 * BJ(개인): one sent to a member, on their own). Each completed line is a 빙고 run on OBS `?sigbingo` with the 빙고 보너스 for
 * its member (공용 판 · BJ(팀): whose donation completed it; 땅따먹기: who owns the whole line; BJ(개인): the board's member).
 * The operator can open or close cells.
 */

type StoredBoard = NonNullable<MockBroadcast["sigBingo"]>;
type StoredGrid = StoredBoard["grids"][string];

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const optionalPrice = (v: unknown) => v === null || v === undefined || isInt(v, 0, SIGNATURE_LIMITS.priceMax);
const TEAM_KEYS = ["A", "B"] as const;
const teamColor = (key: string) => MULTI_TEAM_COLORS[TEAM_KEYS.indexOf(key as "A" | "B")];

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

/** The live board — none for one kept from before the boards (2026-10-28); 빙고 시작 makes a new one. */
const boardOf = (b: MockBroadcast) => (b.sigBingo?.grids ? b.sigBingo : undefined);

/** size² cells of `pool` in random places (each signature used in turn when there are fewer than cells). */
function newGrid(pool: ReturnType<typeof eligibleOf>, size: number): StoredGrid {
  const filled: typeof pool = [];
  while (filled.length < size * size) filled.push(...shuffled(pool).slice(0, size * size - filled.length));
  return { cells: shuffled(filled).map((x) => ({ signatureId: x.id, signatureName: x.name, opened: null })), lines: [], lastOpened: null };
}

/** The boards a mode starts with: one ("ALL"), A팀 · B팀, or each active member's. */
function gridKeys(b: MockBroadcast, mode: SigBingoMode): string[] {
  if (mode === "TEAM") return [...TEAM_KEYS];
  if (mode === "SOLO") return (mockCrew.crews[b.channelId] ?? []).filter((m) => m.active).map((m) => m.id);
  return ["ALL"];
}

/**
 * 빙고 시작: new boards from the current settings, each with the eligible signatures in its own random places. BJ(팀) only
 * in a team broadcast, BJ(개인) with an active member. `requestId` makes a retried start a no-op. Returns an error message,
 * or null.
 */
export function startSigBingoBoard(b: MockBroadcast, requestId: string, now = Date.now()): string | null {
  if (b.sigBingo?.requestId === requestId) return null;
  const s = sigBingoSettingsOf(b.channelId);
  const pool = eligibleOf(s);
  if (!pool.length) return "빙고판에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요.";
  if (s.mode === "TEAM" && !b.teamMode) return "BJ(팀)은 팀 배틀 방송에서만 할 수 있어요.";
  const keys = gridKeys(b, s.mode);
  if (!keys.length) return "BJ(개인)은 활동 중인 멤버가 있어야 해요.";
  b.sigBingo = {
    size: s.size,
    mode: s.mode,
    reveal: s.reveal,
    startedAt: new Date(now).toISOString(),
    requestId,
    grids: Object.fromEntries(keys.map((key) => [key, newGrid(pool, s.size)]))
  };
  return null;
}

/**
 * The board a donation to `memberId` (or none) opens a cell on: 공용 판 any, 땅따먹기 · BJ(팀) · BJ(개인) only one to a member
 * — on the one board, their team's, or their own (a member activated after 빙고 시작 gets theirs then). Null: none.
 */
function gridKeyOf(b: MockBroadcast, board: StoredBoard, memberId: string | null): string | null {
  if (board.mode === "SHARED") return "ALL";
  if (!memberId) return null;
  if (board.mode === "TEAM") return b.teams[memberId] ?? null;
  if (board.mode === "SOLO" && !board.grids[memberId]) {
    const pool = eligibleOf(sigBingoSettingsOf(b.channelId));
    if (!pool.length) return null;
    board.grids[memberId] = newGrid(pool, board.size);
  }
  return board.mode === "SOLO" ? memberId : "ALL";
}

/** The member who owns every cell of a line (땅따먹기), or null. */
function lineOwner(grid: StoredGrid, cells: number[]) {
  const first = grid.cells[cells[0]].opened?.memberId ?? null;
  return first && cells.every((c) => grid.cells[c].opened?.memberId === first) ? first : null;
}

/**
 * Opens a cell of the `key` board, then records each line through it that is now 빙고 (땅따먹기: owned by one member
 * throughout) — a run on OBS with the 빙고 보너스 for its member (none without one). `runId`: the base id of those runs.
 */
function openCell(b: MockBroadcast, board: StoredBoard, key: string, index: number, opener: { memberId: string | null; donationId: string | null; manual: boolean }, runId: string, now = Date.now()) {
  const grid = board.grids[key];
  const cell = grid.cells[index];
  cell.opened = { memberId: opener.memberId, at: new Date(now).toISOString(), donationId: opener.donationId };
  grid.lastOpened = index;
  const bonus = sigBingoSettingsOf(b.channelId).bonus;
  sigBingoLines(board.size).forEach((cells, line) => {
    if (grid.lines.includes(line) || !cells.includes(index) || !cells.every((c) => grid.cells[c].opened)) return;
    const owner = board.mode === "TERRITORY" ? lineOwner(grid, cells) : board.mode === "SOLO" ? key : opener.memberId;
    if (board.mode === "TERRITORY" && !owner) return;
    grid.lines.push(line);
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
        label: `${board.mode === "TEAM" ? `${key}팀 ` : ""}빙고! ${sigBingoLineName(board.size, line)}`,
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
 * on, a 시그니처 후원 (not excluded) opens the first closed cell of its signature on the board it goes to.
 */
export function sigBingoForSignature(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined }) {
  const live = liveBroadcastOf(channelId);
  const s = sigBingoSettingsOf(channelId);
  const board = live && boardOf(live);
  if (!live || !board || !s.auto || !input.signatureId || s.excluded.includes(input.signatureId)) return;
  const memberId = input.memberId && isActiveMember(channelId, input.memberId) ? input.memberId : null;
  const key = gridKeyOf(live, board, memberId);
  if (!key) return;
  const index = board.grids[key].cells.findIndex((c) => c.signatureId === input.signatureId && !c.opened);
  if (index >= 0) openCell(live, board, key, index, { memberId, donationId: input.donationId, manual: false }, `sigbingo-${input.donationId}`);
}

/**
 * 수동 칸 열기 · 닫기 (`open`) on the `grid` board (missing = the one board): opening an open cell or closing a closed one is
 * a no-op. 땅따먹기 opens a cell for a member, BJ(팀) for one of that team or none, BJ(개인) for the board's member; a cell in
 * a 빙고 line stays open. Returns an error message, or null.
 */
export function setSigBingoCell(b: MockBroadcast, input: { grid: unknown; index: unknown; open: unknown; memberId: unknown }, now = Date.now()): string | null {
  const board = boardOf(b);
  if (!board) return "빙고를 먼저 시작해 주세요.";
  const key = input.grid === undefined || input.grid === null ? "ALL" : input.grid;
  const grid = typeof key === "string" && Object.hasOwn(board.grids, key) ? board.grids[key] : undefined;
  if (!grid) return "빙고판을 다시 골라 주세요.";
  if (!isInt(input.index, 0, grid.cells.length - 1) || typeof input.open !== "boolean") return "칸을 다시 골라 주세요.";
  const cell = grid.cells[input.index];
  if (!input.open) {
    if (!cell.opened) return null;
    if (grid.lines.some((line) => sigBingoLines(board.size)[line].includes(input.index as number))) return "빙고 줄에 들어간 칸은 닫을 수 없어요.";
    cell.opened = null;
    if (grid.lastOpened === input.index) grid.lastOpened = null;
    return null;
  }
  if (cell.opened) return null;
  const picked = typeof input.memberId === "string" && isActiveMember(b.channelId, input.memberId) ? input.memberId : null;
  if (board.mode === "TERRITORY" && !picked) return "땅따먹기에서는 칸을 차지할 멤버를 골라 주세요.";
  if (board.mode === "TEAM" && picked && b.teams[picked] !== key) return `${key}팀 멤버를 골라 주세요.`;
  const memberId = board.mode === "SOLO" ? (key as string) : picked;
  openCell(b, board, key as string, input.index, { memberId, donationId: null, manual: true }, `sigbingo-m${now.toString(36)}-${key}-${input.index}`, now);
  return null;
}

/** 판 비우기: the boards go away (빙고 시작 makes new ones). */
export function clearSigBingoBoard(b: MockBroadcast) {
  delete b.sigBingo;
}

/**
 * 남은 시그: the closed cells by signature over every board, cheapest first (a deleted signature keeps the name on its
 * cell).
 */
function remainingOf(board: StoredBoard | undefined): SigBingoRemaining[] {
  const by = new Map<string, SigBingoRemaining>();
  for (const c of Object.values(board?.grids ?? {}).flatMap((g) => g.cells)) {
    if (c.opened) continue;
    const row = by.get(c.signatureId) ?? { signatureId: c.signatureId, name: c.signatureName, price: mockSignatures.items.find((x) => x.id === c.signatureId)?.price ?? 0, cells: 0 };
    row.cells += 1;
    by.set(c.signatureId, row);
  }
  return [...by.values()].sort((x, y) => x.price - y.price || x.name.localeCompare(y.name));
}

/** The boards in order: the one board; A팀, B팀; the members in crew order (then any removed since). */
function gridsView(b: MockBroadcast, board: StoredBoard): SigBingoGrid[] {
  const crew = mockCrew.crews[b.channelId] ?? [];
  const keys = Object.keys(board.grids);
  const order = board.mode === "SOLO" ? [...crew.map((m) => m.id).filter((id) => keys.includes(id)), ...keys.filter((k) => !crew.some((m) => m.id === k))] : keys;
  return order.map((key) => {
    const grid = board.grids[key];
    const owner = board.mode === "SOLO" ? crew.find((m) => m.id === key) : undefined;
    return {
      key,
      label: board.mode === "TEAM" ? `${key}팀` : board.mode === "SOLO" ? (owner?.name ?? "삭제된 멤버") : "",
      color: board.mode === "TEAM" ? teamColor(key) : (owner?.color ?? null),
      members: board.mode === "TEAM" ? Object.keys(b.teams).filter((id) => b.teams[id] === key) : board.mode === "SOLO" ? [key] : [],
      lines: [...grid.lines],
      lastOpened: grid.lastOpened,
      cells: grid.cells.map((c) => {
        const sig = mockSignatures.items.find((x) => x.id === c.signatureId);
        const m = c.opened?.memberId ? crew.find((x) => x.id === c.opened!.memberId) : undefined;
        return {
          signatureId: c.signatureId,
          signatureName: c.signatureName,
          imageUrl: sig ? signatureImageOf(sig) : null,
          opened: c.opened && { memberName: m?.name ?? (c.opened.memberId ? "삭제된 멤버" : null), memberColor: m?.color ?? null, at: c.opened.at, manual: c.opened.donationId === null }
        };
      })
    };
  });
}

export function sigBingoLive(b: MockBroadcast): SigBingoLive {
  const s = sigBingoSettingsOf(b.channelId);
  const board = boardOf(b);
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "SIG_BINGO"),
    eligible: eligibleOf(s).length,
    remaining: remainingOf(board),
    board: board ? { size: board.size, mode: board.mode, reveal: board.reveal, startedAt: board.startedAt, grids: gridsView(b, board) } : null
  };
}
