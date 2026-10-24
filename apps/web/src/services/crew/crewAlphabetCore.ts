import { randomUUID } from "node:crypto";
import { drawIndex, gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import {
  ALPHABET_MISS_MAX,
  ALPHABET_PRIZES_MAX,
  ALPHABET_PRIZE_LABEL_MAX,
  ALPHABET_PRIZE_POINTS_MAX,
  ALPHABET_PRIZE_WEIGHT_MAX,
  ALPHABET_THEMES,
  ALPHABET_WORD_MAX,
  ALPHABET_WORD_MIN,
  DEFAULT_ALPHABET,
  type AlphabetLive,
  type AlphabetPrize,
  type AlphabetSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 알파벳 모으기 (server-only) — code-first, StreamDonate 알파벳 모으기 참고 (a game on crewGameCore). A 시그니처 후원 to a
 * member spins a horizontal reel (자동), or the operator does (수동): a letter of the word (evenly) or 꽝 (꽝 비율). A letter
 * fills the member's first empty slot of it (none left: 중복); a completed word draws a 상품 by 가중치 — a second run, with
 * the 상품's points — and the member starts over with their next letter.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 알파벳 모으기 settings (defaults until saved). */
export const alphabetSettingsOf = (channelId: string): AlphabetSettings => mockCrew.alphabets?.[channelId] ?? DEFAULT_ALPHABET;

/** The word's letters, each once — the reel's letters. */
export const alphabetLetters = (word: string) => [...new Set(word)];

/**
 * Validates the settings: the word is 2 ~ 12 letters A–Z (saved in capitals). `knownPrizes`: the saved 상품 ids (kept); any
 * other id is replaced. The word and the 상품 문구 are shown on stream (금지어).
 */
export function parseAlphabetSettings(input: unknown, forbidden: string[], signatureIds: string[], knownPrizes: string[]): AlphabetSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const banned = (text: string) => forbidden.some((w) => text.toLowerCase().includes(w));
  const word = typeof v.word === "string" ? v.word.trim().toUpperCase() : "";
  if (!/^[A-Z]+$/.test(word) || word.length < ALPHABET_WORD_MIN || word.length > ALPHABET_WORD_MAX) return { message: `단어는 영문 알파벳 ${ALPHABET_WORD_MIN} ~ ${ALPHABET_WORD_MAX}자로 입력해 주세요.` };
  if (banned(word)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!isInt(v.missPercent, 0, ALPHABET_MISS_MAX)) return { message: `꽝 비율은 0 ~ ${ALPHABET_MISS_MAX}%예요.` };
  const theme = ALPHABET_THEMES.find((t) => t.key === v.theme)?.key;
  if (!theme) return { message: "단어판 테마를 골라 주세요." };
  if (!Array.isArray(v.prizes) || v.prizes.length > ALPHABET_PRIZES_MAX) return { message: `상품은 ${ALPHABET_PRIZES_MAX}개까지 만들 수 있어요.` };
  const prizes: AlphabetPrize[] = [];
  for (const raw of v.prizes) {
    const p = rec(raw);
    const label = typeof p.label === "string" ? p.label.trim() : "";
    if (!label || label.length > ALPHABET_PRIZE_LABEL_MAX) return { message: `상품 문구는 1~${ALPHABET_PRIZE_LABEL_MAX}자로 입력해 주세요.` };
    if (banned(label)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (!isInt(p.points, 0, ALPHABET_PRIZE_POINTS_MAX)) return { message: `상품 점수는 0 ~ ${ALPHABET_PRIZE_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
    if (!isInt(p.weight, 1, ALPHABET_PRIZE_WEIGHT_MAX)) return { message: `상품 가중치는 1 ~ ${ALPHABET_PRIZE_WEIGHT_MAX} 사이 정수예요.` };
    const keep = typeof p.id === "string" && knownPrizes.includes(p.id) && !prizes.some((x) => x.id === p.id);
    prizes.push({ id: keep ? (p.id as string) : `ap-${randomUUID().slice(0, 8)}`, label, points: p.points, weight: p.weight });
  }
  return { ...common, word, missPercent: v.missPercent, prizes, theme };
}

/** The broadcast's progress for `word` (another word starts over). */
function progressOf(b: MockBroadcast, word: string) {
  if (b.alphabet?.word !== word) b.alphabet = { word, members: {} };
  return b.alphabet;
}

/** Spins once for `start.memberId` (the caller checks the word is set) and queues the run(s) on OBS `?alphabet`. */
export function runAlphabet(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const s = alphabetSettingsOf(b.channelId);
  const letters = alphabetLetters(s.word);
  // 꽝 비율 out of 100; the rest is split evenly over the letters.
  const drawn = drawIndex([...letters.map(() => 100 - s.missPercent), s.missPercent * letters.length]);
  if (drawn === letters.length) return recordRun(b, { ...start, game: "ALPHABET", itemId: null, label: "꽝", kind: "MISS", value: 0, points: 0 }, now);
  const letter = letters[drawn];
  const m = (progressOf(b, s.word).members[start.memberId] ??= { slots: Array.from(s.word, () => null), done: 0, full: false, log: [] });
  if (m.full) {
    m.slots = Array.from(s.word, () => null);
    m.full = false;
  }
  const slot = [...s.word].findIndex((c, j) => c === letter && !m.slots[j]);
  const run = recordRun(b, { ...start, game: "ALPHABET", itemId: letter, label: slot < 0 ? `${letter} (중복)` : letter, kind: "TEXT", value: 0, points: 0 }, now);
  if (slot < 0) return run;
  m.slots[slot] = { revealAt: run.revealAt };
  m.log.push({ at: run.revealAt, kind: "LETTER", slot });
  if (m.slots.every(Boolean)) {
    m.full = true;
    m.done += 1;
    const prize = s.prizes.length ? s.prizes[drawIndex(s.prizes.map((p) => p.weight))] : null;
    const points = prize?.points ?? 0;
    const done = recordRun(
      b,
      { ...start, id: `${start.id}-done`, game: "ALPHABET", itemId: prize?.id ?? null, label: prize ? `단어 완성! ${prize.label}` : "단어 완성!", kind: points ? "ADD" : "TEXT", value: points, points },
      now
    );
    m.log.push({ at: done.revealAt, kind: "DONE", slot: null });
  }
  return run;
}

/** 자동 (crewGameTriggers): once per 시그니처 후원 to a member, while 자동 is on and the word is set. */
export function alphabetForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const s = alphabetSettingsOf(channelId);
  const t = s.word ? signatureTrigger(channelId, "ALPHABET", s, input) : null;
  if (t) runAlphabet(t.live, t.start);
}

/**
 * 단어판 비우기: one member's letters (`memberId`; their 완성 count stays — OBS empties it now, and letters still queued
 * from before light no more), or everyone's board and count (null).
 */
export function resetAlphabetBoard(b: MockBroadcast, memberId: string | null, now = Date.now()) {
  if (memberId === null) {
    delete b.alphabet;
    return;
  }
  const m = b.alphabet?.members[memberId];
  if (m) {
    m.slots = m.slots.map(() => null);
    m.full = false;
    m.log = m.log.filter((e) => Date.parse(e.at) <= now);
    m.log.push({ at: new Date(now).toISOString(), kind: "CLEAR", slot: null });
  }
}

export function alphabetLive(b: MockBroadcast): AlphabetLive {
  const s = alphabetSettingsOf(b.channelId);
  const progress = b.alphabet?.word === s.word ? b.alphabet.members : {};
  const crew = mockCrew.crews[b.channelId] ?? [];
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "ALPHABET"),
    letters: alphabetLetters(s.word),
    boards: crew
      .filter((m) => m.active || progress[m.id])
      .map((m) => ({
        memberId: m.id,
        name: m.name,
        color: m.color,
        slots: [...s.word].map((letter, j) => ({ letter, revealAt: progress[m.id]?.slots[j]?.revealAt ?? null })),
        done: progress[m.id]?.done ?? 0,
        timeline: structuredClone(progress[m.id]?.log ?? [])
      }))
  };
}
