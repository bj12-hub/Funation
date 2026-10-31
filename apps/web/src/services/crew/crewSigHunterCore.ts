import { randomUUID } from "node:crypto";
import { mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { excelOf, extraPoints, isActiveMember, liveBroadcastOf, parseMultiplier, scoreFn } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun, shuffled, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_SIG_HUNTER,
  GAME_TIMING,
  SIG_HUNTER_BANDS_MAX,
  SIG_HUNTER_MULTIPLIER_MAX,
  SIG_HUNTER_ROUNDS_MAX,
  SIG_HUNTER_SLOTS_MAX,
  sigHunterSlotsOf,
  type SigHunterBand,
  type SigHunterLive,
  type SigHunterRound,
  type SigHunterSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그니처 헌터 (server-only) — code-first, StreamDonate 시그니처 헌터 참고 (a signature game on crewGameCore). 헌트 시작 places
 * the 1라운드 signatures (its 금액 범위) in random slots, with its 몰수권 hidden among them. A 시그니처 후원 buys the first open
 * slot of its signature (SOLD OUT): its 기여도 is the donation's points × the 라운드 배수 (the 배수 part is the run's points,
 * for the member). Buying a 몰수권 slot takes the SOLD OUT 기여도 of the other members' slots on the board (the run moves it).
 * When every slot is sold the next 라운드 follows its last result; past the last 라운드 its settings repeat (6+). With 몰수권
 * 자동 잠김 a 몰수권 opening locks the board until 다음 라운드.
 */

type StoredBoard = NonNullable<MockBroadcast["sigHunter"]>;
type Opener = Pick<StoredRun, "memberId" | "trigger" | "sourceId"> & { base: number };

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const optionalPrice = (v: unknown) => v === null || v === undefined || isInt(v, 0, SIGNATURE_LIMITS.priceMax);
const iso = (ms: number) => new Date(ms).toISOString();

/** The channel's 시그니처 헌터 settings (defaults until saved; saved before 몰수권 최소 금액 · 자동 잠김 (2026-10-28) without them). */
export const sigHunterSettingsOf = (channelId: string): SigHunterSettings => ({ ...DEFAULT_SIG_HUNTER, ...mockCrew.sigHunters?.[channelId] });

/** Validates the settings: 1 ~ 6 라운드. `knownRounds`: the saved 라운드 ids (kept); any other id is replaced. */
export function parseSigHunterSettings(input: unknown, forbidden: string[], signatureIds: string[], knownRounds: string[]): SigHunterSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (!Array.isArray(v.rounds) || v.rounds.length < 1 || v.rounds.length > SIG_HUNTER_ROUNDS_MAX) return { message: `라운드는 1 ~ ${SIG_HUNTER_ROUNDS_MAX}개예요.` };
  const rounds: SigHunterRound[] = [];
  for (const [i, raw] of v.rounds.entries()) {
    const r = rec(raw);
    const n = `${i + 1}라운드`;
    if (!isInt(r.slots, 1, SIG_HUNTER_SLOTS_MAX)) return { message: `${n} 슬롯은 1 ~ ${SIG_HUNTER_SLOTS_MAX}칸이에요.` };
    if (!optionalPrice(r.priceMin) || !optionalPrice(r.priceMax)) return { message: `${n} 금액 범위를 확인해 주세요.` };
    const priceMin = (r.priceMin as number | null | undefined) ?? null;
    const priceMax = (r.priceMax as number | null | undefined) ?? null;
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) return { message: `${n} 금액 범위의 최소가 최대보다 커요.` };
    const multiplier = parseMultiplier(r.multiplier, SIG_HUNTER_MULTIPLIER_MAX);
    if (multiplier === null || multiplier < 1) return { message: `${n} 배수는 1 ~ ${SIG_HUNTER_MULTIPLIER_MAX}배, 소수 둘째 자리까지예요.` };
    const bands = parseBands(r.bands, n);
    if ("message" in bands) return bands;
    const total = sigHunterSlotsOf({ slots: r.slots, bands: bands.bands });
    if (total > SIG_HUNTER_SLOTS_MAX) return { message: `${n} 슬롯은 추가 금액 구간까지 모두 ${SIG_HUNTER_SLOTS_MAX}칸까지예요.` };
    if (!isInt(r.forfeits, 0, total - 1)) return { message: `${n} 몰수권은 슬롯보다 적게, 0 ~ ${total - 1}개예요.` };
    const keep = typeof r.id === "string" && knownRounds.includes(r.id) && !rounds.some((x) => x.id === r.id);
    rounds.push({
      id: keep ? (r.id as string) : `hr-${randomUUID().slice(0, 8)}`,
      slots: r.slots,
      priceMin,
      priceMax,
      multiplier,
      forfeits: r.forfeits,
      ...(bands.bands.length ? { bands: bands.bands } : {})
    });
  }
  // 몰수권 최소 금액 · 자동 잠김 (2026-10-28): a screen from before sends neither — 제한 없음, off.
  const forfeitMin = v.forfeitMin === undefined ? 0 : v.forfeitMin;
  if (!isInt(forfeitMin, 0, SIGNATURE_LIMITS.priceMax)) return { message: "몰수권 최소 금액을 확인해 주세요." };
  if (v.forfeitLock !== undefined && typeof v.forfeitLock !== "boolean") return { message: "몰수권 자동 잠김을 확인해 주세요." };
  return { ...common, rounds, forfeitMin, forfeitLock: v.forfeitLock === true };
}

/** A 라운드's 추가 금액 구간 (missing = none): up to SIG_HUNTER_BANDS_MAX, each 1 칸 or more and its own range. */
function parseBands(input: unknown, n: string): { bands: SigHunterBand[] } | { message: string } {
  if (input === undefined || input === null) return { bands: [] };
  if (!Array.isArray(input) || input.length > SIG_HUNTER_BANDS_MAX) return { message: `${n} 추가 금액 구간은 ${SIG_HUNTER_BANDS_MAX}개까지예요.` };
  const bands: SigHunterBand[] = [];
  for (const [k, raw] of input.entries()) {
    const b = rec(raw);
    const name = `${n} 추가 구간 ${k + 1}`;
    if (!isInt(b.slots, 1, SIG_HUNTER_SLOTS_MAX)) return { message: `${name}의 슬롯은 1칸 이상이에요.` };
    if (!optionalPrice(b.priceMin) || !optionalPrice(b.priceMax)) return { message: `${name}의 금액 범위를 확인해 주세요.` };
    const priceMin = (b.priceMin as number | null | undefined) ?? null;
    const priceMax = (b.priceMax as number | null | undefined) ?? null;
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) return { message: `${name}의 금액 범위 최소가 최대보다 커요.` };
    bands.push({ slots: b.slots, priceMin, priceMax });
  }
  return { bands };
}

/** The settings of 라운드 `round` (past the last one, the last one's). */
const roundOf = (s: SigHunterSettings, round: number) => s.rounds[Math.min(round, s.rounds.length) - 1];

/** The signatures a 라운드 (or one of its 추가 금액 구간) draws from: active, not excluded, within its 금액 범위. */
export const sigHunterEligible = (s: SigHunterSettings, r: Pick<SigHunterBand, "priceMin" | "priceMax">) =>
  mockSignatures.items.filter((x) => x.active && !s.excluded.includes(x.id) && (r.priceMin === null || x.price >= r.priceMin) && (r.priceMax === null || x.price <= r.priceMax));

/**
 * A 라운드's board from the settings saved now: each 금액 범위's signatures for its slots (each in turn when fewer), all in
 * random slots, its 몰수권 in random ones — among slots at the 몰수권 최소 금액 or more (as many as there are). null when a
 * range has no signature.
 */
function newBoard(s: SigHunterSettings, requestId: string, round: number, now: number): StoredBoard | null {
  const r = roundOf(s, round);
  const filled: ReturnType<typeof sigHunterEligible> = [];
  for (const range of [r, ...(r.bands ?? [])]) {
    const pool = sigHunterEligible(s, range);
    if (!pool.length) return null;
    const part: typeof pool = [];
    while (part.length < range.slots) part.push(...shuffled(pool).slice(0, range.slots - part.length));
    filled.push(...part);
  }
  const placed = shuffled(filled);
  const forfeit = new Set(shuffled(placed.flatMap((x, i) => (x.price >= s.forfeitMin ? [i] : []))).slice(0, r.forfeits));
  return {
    requestId,
    startedAt: iso(now),
    round,
    multiplier: r.multiplier,
    slots: placed.map((x, i) => ({ signatureId: x.id, forfeit: forfeit.has(i), sold: null })),
    lastSold: null,
    advanceAt: null,
    lockedAt: null
  };
}

const noSignatures = (round: number) => `${round}라운드에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요.`;

/** 헌트 시작: 1라운드 from the saved settings (replacing the board there). `requestId` makes a retried start a no-op. */
export function startSigHunterBoard(b: MockBroadcast, requestId: string, now = Date.now()): string | null {
  if (b.sigHunter?.requestId === requestId) return null;
  const board = newBoard(sigHunterSettingsOf(b.channelId), requestId, 1, now);
  if (!board) return noSignatures(1);
  b.sigHunter = board;
  return null;
}

/** The next 라운드 replaces the board; without signatures for it the board stays (no longer waiting). Returns an error message, or null. */
function nextRound(b: MockBroadcast, board: StoredBoard, now: number): string | null {
  const next = newBoard(sigHunterSettingsOf(b.channelId), board.requestId, board.round + 1, now);
  if (!next) {
    board.advanceAt = null;
    return noSignatures(board.round + 1);
  }
  b.sigHunter = next;
  return null;
}

/** A sold-out board moves on at its `advanceAt` (`selling`: a new sale does not wait). Returns the current board. */
export function settleSigHunter(b: MockBroadcast, now = Date.now(), selling = false): StoredBoard | undefined {
  const board = b.sigHunter;
  if (board?.advanceAt && (selling || now >= Date.parse(board.advanceAt))) nextRound(b, board, now);
  return b.sigHunter;
}

/**
 * Sells a slot and records the run: the 배수 part for the member (SOLD OUT), or for a 몰수권 that plus the 기여도 of every
 * SOLD OUT slot of another member not taken yet — which they lose (`shares`). A 몰수권 without a member takes nothing.
 */
function sell(b: MockBroadcast, board: StoredBoard, index: number, opener: Opener, runId: string, now: number) {
  const slot = board.slots[index];
  const name = mockSignatures.items.find((x) => x.id === slot.signatureId)?.name ?? "시그니처";
  const extra = opener.memberId ? extraPoints(opener.base, board.multiplier) : 0;
  const run = { id: runId, game: "SIG_HUNTER" as const, memberId: opener.memberId, trigger: opener.trigger, sourceId: opener.sourceId, basePoints: opener.base, itemId: slot.signatureId };
  let stored: StoredRun;
  if (slot.forfeit && opener.memberId) {
    const taken = board.slots.filter((x) => x.sold && !x.forfeit && !x.sold.absorbedBy && x.sold.memberId && x.sold.memberId !== opener.memberId && x.sold.points > 0);
    const lost = new Map<string, number>();
    for (const x of taken) {
      lost.set(x.sold!.memberId!, (lost.get(x.sold!.memberId!) ?? 0) + x.sold!.points);
      x.sold!.absorbedBy = opener.memberId;
    }
    const points = extra + [...lost.values()].reduce((s, p) => s + p, 0);
    stored = recordRun(
      b,
      {
        ...run,
        label: taken.length ? `몰수권! ${taken.length}칸 흡수` : "몰수권! 흡수할 칸 없음",
        kind: points ? "ADD" : "TEXT",
        value: points,
        points,
        shares: [...lost].map(([memberId, p]) => ({ memberId, points: -p }))
      },
      now
    );
  } else if (slot.forfeit) {
    stored = recordRun(b, { ...run, label: "몰수권 (멤버 없음)", kind: "TEXT", value: 0, points: 0 }, now);
  } else {
    stored = recordRun(b, { ...run, label: `${name} SOLD OUT`, kind: extra ? "MULTIPLY" : "TEXT", value: extra ? board.multiplier : 0, points: extra }, now);
  }
  slot.sold = { memberId: opener.memberId || null, at: stored.at, revealAt: stored.revealAt, donationId: opener.sourceId, points: opener.memberId ? opener.base + extra : 0, absorbedBy: null };
  board.lastSold = index;
  // 몰수권 자동 잠김: the board stops selling until 다음 라운드.
  if (slot.forfeit && sigHunterSettingsOf(b.channelId).forfeitLock) board.lockedAt = stored.at;
  if (board.slots.every((x) => x.sold)) board.advanceAt = iso(Date.parse(stored.revealAt) + GAME_TIMING.SIG_HUNTER.resultSec * 1000);
}

/**
 * Called for every completed donation (crewGameTriggers): while a crew broadcast is live with a hunt and 시그니처 후원으로
 * SOLD OUT is on, a 시그니처 후원 (not excluded) buys the first open slot of its signature — for the member the supporter
 * picked, or none (SOLD OUT without 기여도).
 */
export function sigHunterForSignature(
  channelId: string,
  input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number },
  now = Date.now()
) {
  const live = liveBroadcastOf(channelId);
  const s = sigHunterSettingsOf(channelId);
  if (!live?.sigHunter || !s.auto || !input.signatureId || s.excluded.includes(input.signatureId)) return;
  const runId = `sighunter-${input.donationId}`;
  if ((live.gameRuns ?? []).some((r) => r.id === runId)) return;
  const board = settleSigHunter(live, now, true)!;
  if (board.lockedAt) return;
  const index = board.slots.findIndex((x) => x.signatureId === input.signatureId && !x.sold);
  if (index < 0) return;
  const memberId = input.memberId && isActiveMember(channelId, input.memberId) ? input.memberId : "";
  const signatureName = mockSignatures.items.find((x) => x.id === input.signatureId)?.name ?? "시그니처";
  sell(
    live,
    board,
    index,
    { memberId, trigger: { kind: "SIGNATURE", signatureId: input.signatureId, signatureName }, sourceId: input.donationId, base: scoreFn(input.fnAmount, excelOf(channelId)) },
    runId,
    now
  );
}

/**
 * 수동 SOLD OUT (`sold` true: a slot of 라운드 `round` for a member or none — no 기여도, a 몰수권 still takes; `requestId` is
 * the run id, so a retry sells nothing more) or 되돌리기 (`sold` false: only a 수동 SOLD OUT that is no 몰수권 and was not
 * taken). Selling a sold slot or restoring an open one is a no-op. Returns an error message, or null.
 */
export function setSigHunterSlot(b: MockBroadcast, input: { index: unknown; round: unknown; sold: unknown; memberId: unknown; requestId: string }, now = Date.now()): string | null {
  const runId = `sighunter-m-${input.requestId}`;
  if ((b.gameRuns ?? []).some((r) => r.id === runId)) return null;
  const board = settleSigHunter(b, now);
  if (!board) return "헌트를 먼저 시작해 주세요.";
  if (input.round !== board.round) return "라운드가 바뀌었어요. 슬롯을 다시 골라 주세요.";
  if (!isInt(input.index, 0, board.slots.length - 1) || typeof input.sold !== "boolean") return "슬롯을 다시 골라 주세요.";
  const slot = board.slots[input.index];
  if (!input.sold) {
    if (!slot.sold) return null;
    if (slot.forfeit) return "몰수권 슬롯은 되돌릴 수 없어요.";
    if (slot.sold.absorbedBy) return "몰수된 슬롯은 되돌릴 수 없어요.";
    if (slot.sold.donationId) return "후원으로 SOLD OUT된 슬롯은 되돌릴 수 없어요.";
    slot.sold = null;
    board.advanceAt = null;
    if (board.lastSold === input.index) board.lastSold = null;
    return null;
  }
  if (slot.sold) return null;
  if (board.lockedAt) return "몰수권이 열려 판이 잠겼어요. 다음 라운드를 눌러 주세요.";
  const memberId = typeof input.memberId === "string" && isActiveMember(b.channelId, input.memberId) ? input.memberId : "";
  sell(b, board, input.index, { memberId, trigger: { kind: "MANUAL" }, sourceId: null, base: 0 }, runId, now);
  return null;
}

/** 다음 라운드 now (from 라운드 `round`: a retry once it has moved on is a no-op). Returns an error message, or null. */
export function nextSigHunterRound(b: MockBroadcast, round: unknown, now = Date.now()): string | null {
  const board = settleSigHunter(b, now);
  if (!board) return "헌트를 먼저 시작해 주세요.";
  return round === board.round ? nextRound(b, board, now) : null;
}

/** 판 비우기: the hunt goes away (헌트 시작 makes a new one). */
export function clearSigHunterBoard(b: MockBroadcast) {
  delete b.sigHunter;
}

/**
 * The hunt as shown (a sold-out board past its `advanceAt` moves on first): `reveal` false (OBS) leaves the 몰수권 of unsold
 * slots out; the studio passes true.
 */
export function sigHunterLive(b: MockBroadcast, reveal: boolean, now = Date.now()): SigHunterLive {
  const crew = mockCrew.crews[b.channelId] ?? [];
  const nameOf = (id: string) => crew.find((x) => x.id === id)?.name ?? "삭제된 멤버";
  const board = settleSigHunter(b, now);
  return {
    settings: structuredClone(sigHunterSettingsOf(b.channelId)),
    runs: gameRunsView(b, "SIG_HUNTER"),
    board: board
      ? {
          round: board.round,
          multiplier: board.multiplier,
          startedAt: board.startedAt,
          lastSold: board.lastSold,
          advanceAt: board.advanceAt,
          locked: !!board.lockedAt,
          slots: board.slots.map((x) => {
            const sig = mockSignatures.items.find((g) => g.id === x.signatureId);
            const m = x.sold?.memberId ? crew.find((c) => c.id === x.sold!.memberId) : undefined;
            return {
              signatureId: x.signatureId,
              signatureName: sig?.name ?? "삭제된 시그니처",
              price: sig?.price ?? 0,
              imageUrl: sig ? signatureImageOf(sig) : null,
              forfeit: x.forfeit && (reveal || !!x.sold),
              sold: x.sold && {
                memberName: m?.name ?? (x.sold.memberId ? "삭제된 멤버" : null),
                memberColor: m?.color ?? null,
                at: x.sold.at,
                revealAt: x.sold.revealAt,
                manual: x.sold.donationId === null,
                points: x.sold.points,
                absorbedBy: x.sold.absorbedBy && nameOf(x.sold.absorbedBy)
              }
            };
          })
        }
      : null
  };
}
