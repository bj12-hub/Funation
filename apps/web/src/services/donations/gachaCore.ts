import { randomInt } from "node:crypto";
import { toDateString } from "@/lib/period";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import type { Gacha, GachaSettings } from "@/services/creator/widgetSettingsTypes";
import { widgetStore } from "@/services/creator/widgetStore";
import { fillGachaMessage, gachaNo, type GachaBoardView, type GachaDrawStatus, type GachaOffer, type GachaRow, type GachaStage, type MyGachaDraw, type RoomGacha } from "./gachaTypes";

/**
 * Server-only 뽑기 store (not a "use server" module). The Donation Core records a draw after the debit
 * with the prize already drawn here (node:crypto); 상품소진형 stock goes down at that moment. Draws play
 * one at a time per channel on the 뽑기 overlay (기계 회전 시간, then the result for 화면 노출 시간).
 * The mock reads the studio's 뽑기 settings for every channel (one widget store), like the 룰렛.
 * TBD: odds disclosure / legal review for paid draws, delivery of prizes, refunds, the limit period.
 */
export type GachaDraw = {
  id: string;
  seq: number;
  channelId: string;
  supporterUserId: string;
  donor: string;
  gachaId: string;
  gachaName: string;
  mode: Gacha["prizeMode"];
  style: Gacha["style"];
  pointColor: string;
  message: string;
  amount: number;
  createdAt: string;
  day: string;
  prize: string;
  blank: boolean;
  startedAt: string | null;
  spinMs: number;
  showMs: number;
  doneAt: string | null;
  /** 수령 처리 by the creator (prizes only; a blank stays null). */
  claimed: boolean | null;
};

type Store = { draws: GachaDraw[]; seq: number };

/** Weighted pick; `rand(n)` returns 0..n-1. */
export function weightedIndex(weights: number[], rand: (n: number) => number = randomInt) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand(total);
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}

/** Past wins on the studio channel (the 당첨 내역 sample of Figma 373:3675). */
function seed(now = Date.now()): Store {
  const at = (min: number) => new Date(now - min * 60_000).toISOString();
  const draw = (seq: number, donor: string, prize: string, blank: boolean, min: number, claimed: boolean | null): GachaDraw => ({
    id: `dr-seed-${seq}`,
    seq,
    channelId: STUDIO_CHANNEL,
    supporterUserId: `seed-${donor}`,
    donor,
    gachaId: "gacha-1",
    gachaName: "뽑기 후원",
    mode: "PROBABILITY",
    style: "CAPSULE",
    pointColor: "#519CFF",
    message: "",
    amount: 3_000,
    createdAt: at(min),
    day: toDateString(new Date(now - min * 60_000)),
    prize,
    blank,
    startedAt: at(min),
    spinMs: 5_000,
    showMs: 5_000,
    doneAt: at(min - 1),
    claimed
  });
  return { draws: [draw(1041, "오늘은된다", "꽝 (다음 기회에)", true, 90, null), draw(1042, "보라색원픽", "문화상품권 5천원", false, 45, false)], seq: 1042 };
}

const g = globalThis as typeof globalThis & { __funationMockGachaV1?: Store };
export const mockGacha = (g.__funationMockGachaV1 ??= seed());

const settings = (): GachaSettings => widgetStore.GACHA;
const findGacha = (id: unknown) => settings().gachas.find((x) => x.id === id && x.enabled) ?? null;

const stockLeft = (gacha: Gacha) => gacha.prizes.reduce((s, p) => s + p.value, 0);

/** What the donation panel shows (enabled 뽑기 only). */
export function gachaOffers(): GachaOffer[] {
  return settings()
    .gachas.filter((x) => x.enabled)
    .map((x) => ({
      id: x.id,
      name: x.name,
      price: x.price,
      mode: x.prizeMode,
      prizes: x.prizes.map((p) => ({ name: p.name, blank: p.kind === "BLANK", percent: x.prizeMode === "PROBABILITY" ? p.value : null, left: x.prizeMode === "STOCK" ? p.value : null })),
      limit: x.limitEnabled ? x.limitCount : null,
      soldOut: x.prizeMode === "STOCK" && stockLeft(x) === 0
    }));
}

export const priceOf = (gachaId: unknown) => findGacha(gachaId)?.price ?? null;

export const usedToday = (channelId: string, userId: string, gachaId: string, now = Date.now()) =>
  mockGacha.draws.filter((d) => d.channelId === channelId && d.supporterUserId === userId && d.gachaId === gachaId && d.day === toDateString(new Date(now))).length;

/** Whether this member may draw now (enabled, stock left, 1인 횟수 한도). */
export function canDraw(channelId: string, userId: string, gachaId: string, now = Date.now()) {
  const x = findGacha(gachaId);
  if (!x) return false;
  if (x.prizeMode === "STOCK" && stockLeft(x) === 0) return false;
  return !x.limitEnabled || usedToday(channelId, userId, gachaId, now) < x.limitCount;
}

export function statusOf(d: GachaDraw, now = Date.now()): GachaDrawStatus {
  if (!d.startedAt) return "QUEUED";
  const t = now - Date.parse(d.startedAt);
  if (t < d.spinMs) return "SPINNING";
  if (d.doneAt || t >= d.spinMs + d.showMs) return "DONE";
  return "RESULT";
}

const ofChannel = (channelId: string) => mockGacha.draws.filter((d) => d.channelId === channelId);
const active = (channelId: string, now: number) => ofChannel(channelId).find((d) => d.startedAt && statusOf(d, now) !== "DONE") ?? null;

/** Draws play in order: the next one starts once the machine is free. */
export function advance(channelId: string, now = Date.now()) {
  if (active(channelId, now)) return;
  const next = ofChannel(channelId).find((d) => !d.startedAt);
  if (next) next.startedAt = new Date(now).toISOString();
}

/** Called by the Donation Core after the debit: draws now (stock goes down), plays later. */
export function enqueueDraw(input: { id: string; channelId: string; supporterUserId: string; donor: string; gachaId: string }, now = Date.now(), rand?: (n: number) => number) {
  const x = findGacha(input.gachaId);
  if (!x) throw new Error("뽑기 not found");
  const weights = x.prizes.map((p) => p.value);
  const index = weightedIndex(weights, rand);
  const prize = x.prizes[index];
  if (x.prizeMode === "STOCK") prize.value -= 1;
  const blank = prize.kind === "BLANK";
  const draw: GachaDraw = {
    ...input,
    seq: ++mockGacha.seq,
    gachaName: x.name,
    mode: x.prizeMode,
    style: x.style,
    pointColor: x.pointColor,
    message: fillGachaMessage(x.messageTemplate, input.donor, x.price),
    amount: x.price,
    createdAt: new Date(now).toISOString(),
    day: toDateString(new Date(now)),
    prize: prize.name,
    blank,
    startedAt: null,
    spinMs: x.spinSec * 1000,
    showMs: Math.max(3, settings().credit.displaySec) * 1000,
    doneAt: null,
    claimed: blank ? null : false
  };
  mockGacha.draws.push(draw);
  advance(input.channelId, now);
  return draw;
}

const revealed = (d: GachaDraw, now: number) => {
  const s = statusOf(d, now);
  return s === "RESULT" || s === "DONE";
};

export function stageOf(channelId: string, now = Date.now()): GachaStage | null {
  advance(channelId, now);
  const d = active(channelId, now);
  if (!d) return null;
  const status = statusOf(d, now) as "SPINNING" | "RESULT";
  const start = Date.parse(d.startedAt!);
  const show = revealed(d, now);
  return {
    id: d.id,
    no: gachaNo(d.seq),
    status,
    gachaName: d.gachaName,
    style: d.style,
    pointColor: d.pointColor,
    donor: d.donor,
    amount: d.amount,
    message: d.message,
    prize: show ? d.prize : null,
    blank: show ? d.blank : null,
    endsAt: new Date(start + d.spinMs + (status === "RESULT" ? d.showMs : 0)).toISOString()
  };
}

export function row(d: GachaDraw, now = Date.now()): GachaRow {
  const show = revealed(d, now);
  return {
    id: d.id,
    no: gachaNo(d.seq),
    gachaName: d.gachaName,
    donor: d.donor,
    amount: d.amount,
    createdAt: d.createdAt,
    status: statusOf(d, now),
    prize: show ? d.prize : null,
    blank: show ? d.blank : null,
    claimed: show ? d.claimed : null
  };
}

export function channelRows(channelId: string, now = Date.now()) {
  advance(channelId, now);
  const draws = ofChannel(channelId);
  return {
    queue: draws.filter((d) => !d.startedAt).map((d) => row(d, now)),
    recent: draws
      .filter((d) => statusOf(d, now) === "DONE")
      .slice(-10)
      .reverse()
      .map((d) => row(d, now)),
    unclaimed: draws.filter((d) => d.claimed === false && revealed(d, now)).length
  };
}

/** One draw's state for the supporter's 후원 내역 (prize only once revealed), or null. */
export function drawState(id: string, now = Date.now()) {
  const d = mockGacha.draws.find((x) => x.id === id);
  if (!d) return null;
  advance(d.channelId, now);
  const show = revealed(d, now);
  return { status: statusOf(d, now), prize: show ? d.prize : null, blank: show ? d.blank : null };
}

export function roomView(channelId: string, userId: string | null, now = Date.now()): RoomGacha {
  const { queue } = channelRows(channelId, now);
  const ids = queue.map((r) => r.id);
  const today = toDateString(new Date(now));
  const mineAll = userId ? ofChannel(channelId).filter((d) => d.supporterUserId === userId) : [];
  const used: Record<string, number> = {};
  for (const d of mineAll) if (d.day === today) used[d.gachaId] = (used[d.gachaId] ?? 0) + 1;
  const mine: MyGachaDraw[] = mineAll
    .slice(-10)
    .reverse()
    .map((d) => {
      const r = row(d, now);
      return { id: d.id, no: r.no, gachaId: d.gachaId, gachaName: d.gachaName, amount: d.amount, createdAt: d.createdAt, status: r.status, position: d.startedAt ? null : ids.indexOf(d.id) + 1, prize: r.prize, blank: r.blank };
    });
  return { waiting: queue.length, usedToday: userId ? used : null, mine };
}

const PERIOD_DAYS = { "오늘 기준": 0, "최근 7일 기준": 6, "최근 30일 기준": 29 } as const;

/** 당첨 리스트 (전광판): revealed prizes (no 꽝) in the 산정 기간, filtered by 상품 타입. */
export function boardOf(channelId: string, now = Date.now()): GachaBoardView {
  const { board } = settings();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - PERIOD_DAYS[board.period]);
  const rows = ofChannel(channelId)
    .filter((d) => !d.blank && revealed(d, now) && Date.parse(d.createdAt) >= from.getTime() && (board.productType === "ALL" || board.productType === d.mode))
    .reverse()
    .map((d) => ({ id: d.id, donor: d.donor, gachaName: d.gachaName, prize: d.prize, claimed: d.claimed === true }));
  return { title: board.title, speed: board.speed, rows };
}

/** The 뽑기 settings popup's 당첨 내역 (studio channel, newest first). */
export function studioWins(now = Date.now()) {
  const draws = ofChannel(STUDIO_CHANNEL).filter((d) => revealed(d, now));
  return {
    wins: [...draws].reverse().map((d) => ({ gacha: d.gachaName, prize: d.prize, claimed: d.claimed })),
    unclaimed: draws.filter((d) => d.claimed === false).length
  };
}
