import { randomInt } from "node:crypto";
import { kstDateString } from "@/lib/period";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { DEFAULT_WIDGET_SETTINGS, type RouletteSettings } from "@/services/creator/widgetSettingsTypes";
import { readWidget } from "@/services/creator/widgetStore";
import {
  ROULETTE_RESULT_SEC,
  rouletteNo,
  type MyRouletteSpin,
  type RoomRoulette,
  type RouletteRemoteRow,
  type RouletteSpinStatus,
  type RouletteStage
} from "./rouletteTypes";

/**
 * Server-only roulette store (not a "use server" module). The Donation Core queues a spin after the
 * debit with the result already drawn here (node:crypto); the broadcast reveals it when the wheel stops.
 * Spins advance lazily on every read: one at a time per channel, started by 자동 시작 or the 리모컨.
 * The mock reads the studio's 룰렛 settings for every channel (one widget store), like the signatures.
 * 2026-10-08 결정: the room's 내 룰렛 belongs to the account (a 재가입 starts without the withdrawn account's spins; the
 * 리모컨 and overlay keep every spin), and 1인 하루 참여 횟수 counts per person (the verified phone, like 출석 · 이벤트 ·
 * 투표) per Korean day, so a same-day 재가입 by the same person does not get a fresh limit. The period is one Korean day
 * (KST 00:00–24:00, 2026-10-08 결정).
 * TBD: refund when a spin cannot run, 결과 자동 노출, audit of creator actions.
 */
export type RouletteSpin = {
  id: string;
  seq: number;
  channelId: string;
  supporterUserId: string;
  /** The start marker of the sender's account (`accountSince()`, null = the slot's first): the room's 내 룰렛 is per account. */
  account: string | null;
  /** The person behind it (`currentPersonKey()`, the verified phone; server-only): the daily limit counts per person. */
  person: string;
  /** The donor's name as sent (the 리모컨 and records). */
  donor: string;
  /** The name the overlay shows: the creator's 대체 메시지 rules applied when it was paid (shownOnStream). */
  shownDonor: string;
  amount: number;
  createdAt: string;
  /** Korean date (KST) the participation counts toward (daily limit). */
  day: string;
  /** The person's participation count that day, and the limit at the time (0 = 제한 없음). */
  nth: number;
  limit: number;
  /** Items as the viewer saw them when paying. */
  items: { name: string; percent: number }[];
  /** Drawn at payment; never shown before the spin. */
  resultIndex: number;
  startedAt: string | null;
  spinMs: number;
  /** Finished early from the 리모컨 (otherwise the result leaves after ROULETTE_RESULT_SEC). */
  doneAt: string | null;
  /** 결과 자동 노출 when the spin started (absent on older records = on), and when ✓ 결과 공개 was pressed. */
  autoReveal?: boolean;
  revealedAt?: string | null;
};

type Store = { spins: RouletteSpin[]; paused: Record<string, boolean>; seq: number; hidden?: Record<string, boolean> };

/** Index by integer percents (they add up to 100). `rand(n)` returns 0..n-1. */
export function drawIndex(items: { percent: number }[], rand: (n: number) => number = randomInt) {
  let r = rand(100);
  for (let i = 0; i < items.length; i++) {
    if (r < items[i].percent) return i;
    r -= items[i].percent;
  }
  return items.length - 1;
}

/** Seed for the studio channel (펀페이 1009:355 sample rows): two waiting, two finished. */
function seed(now = Date.now()): Store {
  const items = DEFAULT_WIDGET_SETTINGS.ROULETTE.items.map(({ name, percent }) => ({ name, percent }));
  const day = kstDateString(new Date(now));
  const at = (min: number) => new Date(now - min * 60_000).toISOString();
  const spin = (seq: number, donor: string, amount: number, min: number, done: number | null): RouletteSpin => ({
    id: `rl-seed-${seq}`,
    seq,
    channelId: STUDIO_CHANNEL,
    supporterUserId: `seed-${donor}`,
    account: null,
    person: `seed-${donor}`,
    donor,
    shownDonor: donor,
    amount,
    createdAt: at(min),
    day,
    nth: 1,
    limit: DEFAULT_WIDGET_SETTINGS.ROULETTE.dailyLimit,
    items,
    resultIndex: done ?? drawIndex(items),
    startedAt: done === null ? null : at(min - 1),
    spinMs: 5_000,
    doneAt: done === null ? null : at(min - 2)
  });
  return {
    spins: [spin(24088, "미션마스터", 20_000, 40, 2), spin(24089, "행운가득", 10_000, 30, 0), spin(24090, "룰렛장인", 10_000, 6, null), spin(24091, "오늘도행운", 30_000, 3, null)],
    paused: {},
    hidden: {},
    seq: 24091
  };
}

// V2: spins keep the name shown on stream (`shownDonor`). V3: spins keep the sender's account and person, `day` is KST.
const g = globalThis as typeof globalThis & { __ssumnationMockRouletteV3?: Store };
export const mockRoulette = (g.__ssumnationMockRouletteV3 ??= seed());
mockRoulette.hidden ??= {};

/** 위젯 화면 숨기기 per channel. */
export const isHidden = (channelId: string) => mockRoulette.hidden?.[channelId] === true;

const settings = (): RouletteSettings => readWidget("ROULETTE");

/** When the result went on screen: right after the spin, or at ✓ 결과 공개 when 결과 자동 노출 was off. */
const shownFrom = (s: RouletteSpin) => (s.autoReveal === false ? (s.revealedAt ? Date.parse(s.revealedAt) : null) : Date.parse(s.startedAt!) + s.spinMs);

export function statusOf(s: RouletteSpin, now = Date.now()): RouletteSpinStatus {
  if (!s.startedAt) return "QUEUED";
  // A finished spin (✓ 완료, or a seed) is done whatever `now` is asked about.
  if (s.doneAt) return "DONE";
  if (now - Date.parse(s.startedAt) < s.spinMs) return "SPINNING";
  const from = shownFrom(s);
  if (from === null) return "WAITING";
  return now - from < ROULETTE_RESULT_SEC * 1000 ? "RESULT" : "DONE";
}

const ofChannel = (channelId: string) => mockRoulette.spins.filter((s) => s.channelId === channelId);
const queued = (channelId: string) => ofChannel(channelId).filter((s) => !s.startedAt);
const active = (channelId: string, now: number) => ofChannel(channelId).find((s) => s.startedAt && statusOf(s, now) !== "DONE") ?? null;

export function startSpin(s: RouletteSpin, now = Date.now()) {
  const st = settings();
  s.startedAt = new Date(now).toISOString();
  s.spinMs = st.spinSec * 1000;
  s.autoReveal = st.autoReveal;
  s.revealedAt = null;
}

/** 자동 시작: the oldest waiting spin starts once the wheel is free (unless 일시정지). */
export function advance(channelId: string, now = Date.now()) {
  if (active(channelId, now) || !settings().autoStart || mockRoulette.paused[channelId]) return;
  const next = queued(channelId)[0];
  if (next) startSpin(next, now);
}

/**
 * Participations of this person (`currentPersonKey()`) in the channel on `now`'s Korean day — across their accounts,
 * so a same-day 재가입 does not reset it (2026-10-08 결정).
 */
export const usedToday = (channelId: string, person: string, now = Date.now()) =>
  ofChannel(channelId).filter((s) => s.person === person && s.day === kstDateString(new Date(now))).length;

/** Whether a new participation is allowed (on, amount, the person's daily limit). */
export function canParticipate(channelId: string, person: string, amount: number, now = Date.now()) {
  const st = settings();
  return st.enabled && amount >= st.minAmount && (st.dailyLimit === 0 || usedToday(channelId, person, now) < st.dailyLimit);
}

/**
 * Called by the Donation Core after the debit: draws now, spins later. `shownDonor` is the name the overlay shows;
 * `account` and `person` are the sender's account marker and person key.
 */
export function enqueueSpin(
  input: { id: string; channelId: string; supporterUserId: string; account: string | null; person: string; donor: string; shownDonor: string; amount: number },
  now = Date.now(),
  rand?: (n: number) => number
) {
  const st = settings();
  const items = st.items.map(({ name, percent }) => ({ name, percent }));
  const spin: RouletteSpin = {
    ...input,
    seq: ++mockRoulette.seq,
    createdAt: new Date(now).toISOString(),
    day: kstDateString(new Date(now)),
    nth: usedToday(input.channelId, input.person, now) + 1,
    limit: st.dailyLimit,
    items,
    resultIndex: drawIndex(items, rand),
    startedAt: null,
    spinMs: st.spinSec * 1000,
    doneAt: null
  };
  mockRoulette.spins.push(spin);
  advance(input.channelId, now);
  return spin;
}

const revealed = (s: RouletteSpin, now: number) => {
  const st = statusOf(s, now);
  return st === "RESULT" || st === "DONE" ? s.items[s.resultIndex].name : null;
};

export function stageOf(channelId: string, now = Date.now()): RouletteStage | null {
  advance(channelId, now);
  const s = active(channelId, now);
  if (!s) return null;
  const status = statusOf(s, now) as "SPINNING" | "WAITING" | "RESULT";
  const spinEnd = Date.parse(s.startedAt!) + s.spinMs;
  const endsAt = status === "RESULT" ? (shownFrom(s) as number) + ROULETTE_RESULT_SEC * 1000 : spinEnd;
  return { id: s.id, no: rouletteNo(s.seq), status, donor: s.shownDonor, amount: s.amount, items: s.items, nth: s.nth, limit: s.limit, result: revealed(s, now), endsAt: new Date(endsAt).toISOString() };
}

export function remoteRow(s: RouletteSpin, now = Date.now()): RouletteRemoteRow {
  return { id: s.id, no: rouletteNo(s.seq), donor: s.donor, amount: s.amount, createdAt: s.createdAt, nth: s.nth, status: statusOf(s, now), result: revealed(s, now) };
}

export function channelRows(channelId: string, now = Date.now()) {
  advance(channelId, now);
  const today = kstDateString(new Date(now));
  const spins = ofChannel(channelId);
  return {
    queue: spins.filter((s) => !s.startedAt).map((s) => remoteRow(s, now)),
    recent: spins
      .filter((s) => statusOf(s, now) === "DONE")
      .slice(-10)
      .reverse()
      .map((s) => remoteRow(s, now)),
    participantsToday: new Set(spins.filter((s) => s.day === today).map((s) => s.supporterUserId)).size
  };
}

/** One participation's state for the supporter's 후원 내역 (result only once revealed), or null. */
export function spinState(id: string, now = Date.now()) {
  const s = mockRoulette.spins.find((x) => x.id === id);
  if (!s) return null;
  advance(s.channelId, now);
  return { status: statusOf(s, now), result: revealed(s, now) };
}

/** The signed-in viewer: member id, their account's start marker (`accountSince()`) and person key (`currentPersonKey()`). */
export type RoomViewer = { userId: string; account: string | null; person: string };

/** 내 룰렛 lists the viewer's current account's spins only; 남은 참여 (`usedToday`) counts the person's day. */
export function roomView(channelId: string, viewer: RoomViewer | null, now = Date.now()): RoomRoulette {
  const { queue, participantsToday } = channelRows(channelId, now);
  const ids = queue.map((r) => r.id);
  const mine: MyRouletteSpin[] = viewer
    ? ofChannel(channelId)
        .filter((s) => s.supporterUserId === viewer.userId && s.account === viewer.account)
        .slice(-10)
        .reverse()
        .map((s) => ({
          id: s.id,
          no: rouletteNo(s.seq),
          amount: s.amount,
          createdAt: s.createdAt,
          status: statusOf(s, now),
          position: s.startedAt ? null : ids.indexOf(s.id) + 1,
          result: revealed(s, now)
        }))
    : [];
  return { waiting: queue.length, participantsToday, usedToday: viewer ? usedToday(channelId, viewer.person, now) : null, mine };
}
