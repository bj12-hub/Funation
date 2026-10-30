import { excelOf, isActiveMember, liveBroadcastOf, scoreFn } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun } from "./crewGameCore";
import {
  DEFAULT_TERRITORY,
  TERRITORY_CELL_POINTS_MAX,
  TERRITORY_HEART_MODES,
  TERRITORY_HEART_POINTS_MAX,
  TERRITORY_SIZE_MAX,
  TERRITORY_SIZE_MIN,
  TERRITORY_TICKERS,
  territoryCoord,
  type TerritoryLive,
  type TerritorySettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 땅따먹기 (server-only) — code-first, StreamDonate 땅따먹기 참고 (a game on crewGameCore). 판 시작 makes an empty N×N board.
 * A member earns 하트 from what they receive (자동: one per 시그니처 후원, or one per 하트 기준 점수 of a donation); the operator
 * adds or takes 하트 by hand. With a 하트 the BJ picks a cell and the operator assigns it (조정실) — an owned cell is taken
 * over. Each assignment is a run on OBS `?territory`; with a 칸 점수 the cell's points move to the new owner.
 */

type StoredBoard = NonNullable<MockBroadcast["territory"]>;

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 땅따먹기 settings (defaults until saved; settings from before 점유 롤링 · BJ 색상 read with them off). */
export const territorySettingsOf = (channelId: string): TerritorySettings => ({ ...DEFAULT_TERRITORY, ...mockCrew.territories?.[channelId] });

/** `memberIds`: the crew's members (a 땅따먹기 색상 is kept only for one of them). */
export function parseTerritorySettings(input: unknown, forbidden: string[], signatureIds: string[], memberIds: string[]): TerritorySettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (!isInt(v.size, TERRITORY_SIZE_MIN, TERRITORY_SIZE_MAX)) return { message: `판 크기는 한 변 ${TERRITORY_SIZE_MIN} ~ ${TERRITORY_SIZE_MAX}칸이에요.` };
  const size = v.size;
  const heartMode = TERRITORY_HEART_MODES.find((m) => m.key === v.heartMode)?.key;
  if (!heartMode) return { message: "하트 받는 방식을 골라 주세요." };
  if (!isInt(v.heartPoints, 1, TERRITORY_HEART_POINTS_MAX)) return { message: `하트 기준 점수는 1 ~ ${TERRITORY_HEART_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
  if (!isInt(v.cellPoints, 0, TERRITORY_CELL_POINTS_MAX)) return { message: `칸 점수는 0 ~ ${TERRITORY_CELL_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
  // A screen from before 점유 롤링 · BJ 색상 sends neither: off, crew colors.
  const ticker = v.ticker === undefined ? "OFF" : TERRITORY_TICKERS.find((x) => x.key === v.ticker)?.key;
  if (!ticker) return { message: "점유 롤링 표시를 골라 주세요." };
  const raw = v.colors === undefined ? {} : v.colors;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { message: "BJ 색상을 확인해 주세요." };
  const colors: Record<string, string> = {};
  for (const [id, color] of Object.entries(raw)) {
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return { message: "BJ 색상은 #RRGGBB 형식이에요." };
    // A member removed since drops out (their color goes with them).
    if (memberIds.includes(id)) colors[id] = color.toLowerCase();
  }
  return { ...common, size, heartMode, heartPoints: v.heartPoints, cellPoints: v.cellPoints, ticker, colors };
}

/** 판 시작: an empty board from the saved size, with no 하트 yet. `requestId` makes a retried start a no-op. */
export function startTerritoryBoard(b: MockBroadcast, requestId: string) {
  if (b.territory?.boardId === requestId) return;
  const { size } = territorySettingsOf(b.channelId);
  b.territory = { boardId: requestId, size, cells: Array.from({ length: size * size }, () => ({ owners: [] })), lastCell: null, hearts: [] };
}

/** A member's unused 하트: what they earned or were given, less the cells assigned to them. */
export function unusedHearts(board: StoredBoard, memberId: string) {
  const earned = board.hearts.filter((h) => h.memberId === memberId).reduce((s, h) => s + h.hearts, 0);
  const used = board.cells.reduce((n, c) => n + c.owners.filter((o) => o.memberId === memberId).length, 0);
  return earned - used;
}

/**
 * Called for every completed donation (crewGameTriggers): while a crew broadcast is live with a board and 후원으로 하트 주기
 * is on, a donation to an active member (not an excluded signature) gives them 하트 — one per 시그니처 후원, or one per 하트
 * 기준 점수 of its points. Once per donation.
 */
export function territoryForDonation(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number }, now = Date.now()) {
  const live = liveBroadcastOf(channelId);
  const s = territorySettingsOf(channelId);
  const board = live?.territory;
  if (!live || !board || !s.auto || !input.memberId || !isActiveMember(channelId, input.memberId)) return;
  if (input.signatureId && s.excluded.includes(input.signatureId)) return;
  if (board.hearts.some((h) => h.donationId === input.donationId)) return;
  const hearts = s.heartMode === "SIGNATURE" ? (input.signatureId ? 1 : 0) : Math.floor(scoreFn(input.fnAmount, excelOf(channelId)) / s.heartPoints);
  if (hearts > 0) board.hearts.push({ memberId: input.memberId, hearts, at: new Date(now).toISOString(), donationId: input.donationId, requestId: null });
}

/** 하트 +1 · −1 by hand for an active member (not below 0). `requestId`: a retry adds or takes no more. Returns an error, or null. */
export function adjustTerritoryHearts(b: MockBroadcast, input: { memberId: unknown; delta: unknown; requestId: string }, now = Date.now()): string | null {
  const board = b.territory;
  if (!board) return "판을 먼저 시작해 주세요.";
  if (board.hearts.some((h) => h.requestId === input.requestId)) return null;
  if (typeof input.memberId !== "string" || !isActiveMember(b.channelId, input.memberId)) return "멤버를 다시 골라 주세요.";
  if (input.delta !== 1 && input.delta !== -1) return "잘못된 요청입니다.";
  if (input.delta === -1 && unusedHearts(board, input.memberId) < 1) return "뺄 하트가 없어요.";
  board.hearts.push({ memberId: input.memberId, hearts: input.delta, at: new Date(now).toISOString(), donationId: null, requestId: input.requestId });
  return null;
}

/**
 * 조정실 할당: gives cell `index` of board `boardId` to an active member for one of their 하트 — an owned cell is taken from
 * its owner (with a 칸 점수, the points move). `requestId` is the run id, so a retry assigns no more. Returns an error, or null.
 */
export function assignTerritoryCell(b: MockBroadcast, input: { boardId: unknown; index: unknown; memberId: unknown; requestId: string }, now = Date.now()): string | null {
  const board = b.territory;
  if (!board) return "판을 먼저 시작해 주세요.";
  const runId = `territory-${input.requestId}`;
  if ((b.gameRuns ?? []).some((r) => r.id === runId)) return null;
  if (input.boardId !== board.boardId) return "판이 바뀌었어요. 칸을 다시 골라 주세요.";
  if (!isInt(input.index, 0, board.cells.length - 1)) return "칸을 다시 골라 주세요.";
  if (typeof input.memberId !== "string" || !isActiveMember(b.channelId, input.memberId)) return "칸을 받을 멤버를 골라 주세요.";
  const memberId = input.memberId;
  const cell = board.cells[input.index];
  const prev = cell.owners.at(-1)?.memberId ?? null;
  if (prev === memberId) return "이미 그 멤버의 칸이에요.";
  const crew = mockCrew.crews[b.channelId] ?? [];
  const name = (id: string) => crew.find((m) => m.id === id)?.name ?? "삭제된 멤버";
  if (unusedHearts(board, memberId) < 1) return `${name(memberId)}의 하트가 없어요.`;
  const coord = territoryCoord(board.size, input.index);
  const points = territorySettingsOf(b.channelId).cellPoints;
  const run = recordRun(
    b,
    {
      id: runId,
      game: "TERRITORY",
      memberId,
      trigger: { kind: "MANUAL" },
      sourceId: null,
      basePoints: 0,
      itemId: coord,
      label: prev ? `${coord} 빼앗기 (${name(prev)})` : `${coord} 점령`,
      kind: points ? "ADD" : "TEXT",
      value: points,
      points,
      ...(prev && points ? { shares: [{ memberId: prev, points: -points }] } : {})
    },
    now
  );
  cell.owners.push({ memberId, at: run.at, revealAt: run.revealAt });
  board.lastCell = input.index;
  return null;
}

/** 판 비우기: the board and its 하트 go away (판 시작 makes a new one). */
export function clearTerritoryBoard(b: MockBroadcast) {
  delete b.territory;
}

export function territoryLive(b: MockBroadcast): TerritoryLive {
  const board = b.territory;
  const crew = mockCrew.crews[b.channelId] ?? [];
  const settings = territorySettingsOf(b.channelId);
  const involved = (id: string) => !!board && (board.hearts.some((h) => h.memberId === id) || board.cells.some((c) => c.owners.some((o) => o.memberId === id)));
  return {
    settings: structuredClone(settings),
    runs: gameRunsView(b, "TERRITORY"),
    board: board
      ? {
          boardId: board.boardId,
          size: board.size,
          lastCell: board.lastCell,
          cells: board.cells.map((c) => ({ owners: c.owners.map((o) => ({ memberId: o.memberId, revealAt: o.revealAt })) }))
        }
      : null,
    members: crew
      .filter((m) => m.active || involved(m.id))
      // 땅따먹기 전용 BJ 색상 first (2026-10-28).
      .map((m) => ({ memberId: m.id, name: m.name, color: settings.colors[m.id] ?? m.color, active: m.active, hearts: board ? unusedHearts(board, m.id) : 0 }))
  };
}
