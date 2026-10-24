import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { sameSecret } from "@/lib/secret";
import { chatStore } from "@/services/broadcast/chatCore";
import {
  DEFAULT_MARBLE,
  MARBLE_HISTORY_MAX,
  MARBLE_KEYWORD_MAX,
  MARBLE_LEAD_SEC,
  MARBLE_MAPS,
  MARBLE_MODES,
  MARBLE_NAME_MAX,
  MARBLE_PLAYERS_MAX,
  MARBLE_PLAYERS_MIN,
  MARBLE_RACE_MAX_SEC,
  MARBLE_RACE_MIN_SEC,
  MARBLE_TITLE_MAX,
  MARBLE_WIN_RULES,
  marbleRuleLabel,
  type MarbleEntrant,
  type MarbleHistoryEntry,
  type MarbleMap,
  type MarbleMode,
  type MarbleRace,
  type MarbleRound,
  type MarbleSettings,
  type MarbleSkill,
  type MarbleWinRule
} from "./marbleTypes";

/**
 * 마블 룰렛 (server-only) — code-first, StreamDonate 마블 룰렛 참고. One round at a time per studio: 참가 모집 시작 opens it
 * (with the settings of that moment); entrants come from chat (the keyword, once per platform user, read from the 통합
 * 채팅 feed since the round opened), the VIP 초대 링크 or the operator, up to the 최대 인원. 레이스 시작 draws the finishing
 * order (server randomness) and the 스킬, fixes the winner by the 당첨 rule and keeps the 회차 결과. No FN, no points.
 */

type StoredEntrant = MarbleEntrant & { key: string; at: string };
type StoredRound = {
  id: string;
  no: number;
  openedAt: string;
  requestId: string;
  mode: MarbleMode;
  keyword: string;
  maxPlayers: number;
  winRule: MarbleWinRule;
  winRank: number;
  map: MarbleMap;
  raceSec: number;
  skills: boolean;
  /** The chat feed's last message when the round opened (and the last one read since). */
  chatSeq: number;
  inviteToken: string | null;
  inviteRequests: string[];
  entrants: StoredEntrant[];
  race: (MarbleRace & { requestId: string }) | null;
};
type MarbleStore = { settings: MarbleSettings; round: StoredRound | null; history: MarbleHistoryEntry[]; seq: number };

const g = globalThis as typeof globalThis & { __ssumnationMockMarbleV1?: MarbleStore };
export const marbleStore = (): MarbleStore => (g.__ssumnationMockMarbleV1 ??= { settings: DEFAULT_MARBLE, round: null, history: [], seq: 0 });

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const iso = (ms: number) => new Date(ms).toISOString();

export function parseMarbleSettings(input: unknown, forbidden: string[]): MarbleSettings | { message: string } {
  const v = rec(input);
  const banned = (text: string) => forbidden.some((w) => text.toLowerCase().includes(w));
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > MARBLE_TITLE_MAX) return { message: `제목은 ${MARBLE_TITLE_MAX}자 이내로 입력해 주세요.` };
  const mode = MARBLE_MODES.find((m) => m.key === v.mode)?.key;
  const map = MARBLE_MAPS.find((m) => m.key === v.map)?.key;
  const winRule = MARBLE_WIN_RULES.find((r) => r.key === v.winRule)?.key;
  if (!mode || !map || !winRule || typeof v.skills !== "boolean") return { message: "설정을 확인해 주세요." };
  const keyword = typeof v.keyword === "string" ? v.keyword.trim() : "";
  if (!keyword || keyword.length > MARBLE_KEYWORD_MAX || /\s/.test(keyword)) return { message: `참가 명령어는 띄어쓰기 없이 1~${MARBLE_KEYWORD_MAX}자로 입력해 주세요.` };
  if (banned(title) || banned(keyword)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!isInt(v.maxPlayers, MARBLE_PLAYERS_MIN, MARBLE_PLAYERS_MAX)) return { message: `최대 인원은 ${MARBLE_PLAYERS_MIN} ~ ${MARBLE_PLAYERS_MAX}명이에요.` };
  if (!isInt(v.winRank, 1, MARBLE_PLAYERS_MAX)) return { message: `당첨 순위는 1 ~ ${MARBLE_PLAYERS_MAX}등이에요.` };
  if (!isInt(v.raceSec, MARBLE_RACE_MIN_SEC, MARBLE_RACE_MAX_SEC)) return { message: `레이스 시간은 ${MARBLE_RACE_MIN_SEC} ~ ${MARBLE_RACE_MAX_SEC}초예요.` };
  return { title, mode, keyword, maxPlayers: v.maxPlayers, map, skills: v.skills, winRule, winRank: v.winRank, raceSec: v.raceSec };
}

/** The round's state by the clock: 모집 중 until raced, then RACING until the last marble is in. */
export const roundStatus = (r: StoredRound, now: number): MarbleRound["status"] => (!r.race ? "OPEN" : now < Date.parse(r.race.finishAt) ? "RACING" : "DONE");

/**
 * 참가 모집 시작: a new round with the settings saved now (chat entries count from now on). `requestId` makes a retried
 * open a no-op. Returns an error message, or null.
 */
export function openMarbleRound(requestId: string, now = Date.now()): string | null {
  const s = marbleStore();
  if (s.round?.requestId === requestId) return null;
  if (s.round && roundStatus(s.round, now) === "RACING") return "레이스가 끝난 뒤에 새 판을 열어 주세요.";
  const set = s.settings;
  s.seq += 1;
  s.round = {
    id: `mr-${randomUUID().slice(0, 8)}`,
    no: s.seq,
    openedAt: iso(now),
    requestId,
    mode: set.mode,
    keyword: set.keyword,
    maxPlayers: set.maxPlayers,
    winRule: set.winRule,
    winRank: set.winRank,
    map: set.map,
    raceSec: set.raceSec,
    skills: set.skills,
    chatSeq: chatStore().seq,
    inviteToken: set.mode === "INVITE" ? randomBytes(18).toString("base64url") : null,
    inviteRequests: [],
    entrants: [],
    race: null
  };
  return null;
}

/** Chat entries of an open 채팅 round: the keyword (alone or first) from each platform user once, up to the 최대 인원. */
export function syncChatEntrants() {
  const r = marbleStore().round;
  if (!r || r.race || r.mode !== "CHAT") return;
  for (const m of chatStore().messages) {
    if (m.seq <= r.chatSeq) continue;
    r.chatSeq = m.seq;
    const text = m.text.trim();
    if (m.hidden || m.fromStudio || (text !== r.keyword && !text.startsWith(`${r.keyword} `))) continue;
    const key = `${m.platform}:${m.author.platformUserId}`;
    if (r.entrants.length >= r.maxPlayers || r.entrants.some((e) => e.key === key)) continue;
    r.entrants.push({ id: `me-${randomUUID().slice(0, 8)}`, name: m.author.displayName.trim().slice(0, MARBLE_NAME_MAX) || "시청자", source: m.platform, key, at: m.receivedAt });
  }
}

/** Adds an entrant by name (operator or 초대 링크): unique by name, within the 최대 인원. Returns an error message, or null. */
function addByName(r: StoredRound, name: unknown, source: "MANUAL" | "INVITE", forbidden: string[], now: number): string | null {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n || n.length > MARBLE_NAME_MAX) return `이름은 1~${MARBLE_NAME_MAX}자로 입력해 주세요.`;
  if (forbidden.some((w) => n.toLowerCase().includes(w))) return "사용할 수 없는 단어가 포함되어 있어요.";
  if (r.entrants.some((e) => e.name.toLowerCase() === n.toLowerCase())) return "이미 참가한 이름이에요.";
  if (r.entrants.length >= r.maxPlayers) return "참가 인원이 다 찼어요.";
  r.entrants.push({ id: `me-${randomUUID().slice(0, 8)}`, name: n, source, key: `${source}:${n.toLowerCase()}`, at: iso(now) });
  return null;
}

const openRound = (roundId: unknown, now: number) => {
  const r = marbleStore().round;
  return r && r.id === roundId && roundStatus(r, now) === "OPEN" ? r : null;
};

/** 수동 추가 while the round is open. Returns an error message, or null. */
export function addMarbleEntrant(input: { roundId: unknown; name: unknown }, forbidden: string[], now = Date.now()): string | null {
  const r = openRound(input.roundId, now);
  if (!r) return "참가 모집 중인 판이 아니에요.";
  return addByName(r, input.name, "MANUAL", forbidden, now);
}

/** 참가 취소 while the round is open (removing someone gone is a no-op). */
export function removeMarbleEntrant(input: { roundId: unknown; entrantId: unknown }, now = Date.now()): string | null {
  const r = openRound(input.roundId, now);
  if (!r) return "참가 모집 중인 판이 아니에요.";
  r.entrants = r.entrants.filter((e) => e.id !== input.entrantId);
  return null;
}

/** The open INVITE round `token` opens, or null. */
function inviteRound(token: unknown, now: number) {
  const r = marbleStore().round;
  return r?.inviteToken && typeof token === "string" && sameSecret(token, r.inviteToken) && roundStatus(r, now) === "OPEN" ? r : null;
}

/** The 초대 링크 page: whether its round is open and how full; null when the link opens no round. */
export function marbleInvite(token: unknown, now = Date.now()) {
  const r = inviteRound(token, now);
  const s = marbleStore();
  return r ? { title: s.settings.title, open: true, players: r.entrants.length, maxPlayers: r.maxPlayers } : null;
}

/** Joining through the 초대 링크 (no login): a name, once; `requestId` makes a retried join count once. */
export function joinMarbleInvite(input: { token: unknown; name: unknown; requestId: string }, forbidden: string[], now = Date.now()): { players: number } | { message: string } {
  const r = inviteRound(input.token, now);
  if (!r) return { message: "참가 모집이 끝났거나 없는 링크예요." };
  if (r.inviteRequests.includes(input.requestId)) return { players: r.entrants.length };
  const message = addByName(r, input.name, "INVITE", forbidden, now);
  if (message) return { message };
  r.inviteRequests.push(input.requestId);
  return { players: r.entrants.length };
}

const shuffled = <T>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const SKILLS: MarbleSkill[] = ["BOOST", "WARP", "BACK", "STOP"];

/**
 * 레이스 시작: the finishing order (server randomness), a 스킬 for about one marble in four (looks only), the winner by the
 * round's 당첨 rule and the 회차 결과 (shown once the race is over). `requestId`: a retried start is the same race. Returns
 * an error message, or null.
 */
export function startMarbleRace(input: { roundId: unknown; requestId: string }, now = Date.now()): string | null {
  const s = marbleStore();
  const r = s.round;
  if (!r || r.id !== input.roundId) return "참가 모집 중인 판이 아니에요.";
  if (r.race) return r.race.requestId === input.requestId ? null : "이미 레이스를 시작했어요.";
  if (r.entrants.length < MARBLE_PLAYERS_MIN) return `참가자가 ${MARBLE_PLAYERS_MIN}명 이상이어야 시작할 수 있어요.`;
  const { map, raceSec, skills } = r;
  const order = shuffled(r.entrants.map((e) => e.id));
  const n = order.length;
  const winnerId = order[r.winRule === "FIRST" ? 0 : r.winRule === "LAST" ? n - 1 : Math.min(r.winRank, n) - 1];
  const startAt = now + MARBLE_LEAD_SEC * 1000;
  const finishAt = startAt + raceSec * 1000;
  r.race = {
    requestId: input.requestId,
    startAt: iso(startAt),
    finishAt: iso(finishAt),
    map,
    order,
    skills: skills ? shuffled(order).slice(0, Math.max(1, Math.round(n / 4))).map((entrantId) => ({ entrantId, kind: SKILLS[randomInt(SKILLS.length)], at: (20 + randomInt(60)) / 100 })) : [],
    winnerId
  };
  s.history.unshift({ no: r.no, at: iso(finishAt), players: n, map, rule: marbleRuleLabel(r.winRule, r.winRank), winner: r.entrants.find((e) => e.id === winnerId)!.name });
  s.history.splice(MARBLE_HISTORY_MAX);
  return null;
}

/** 판 닫기: the round goes away (not while racing). */
export function closeMarbleRound(roundId: unknown, now = Date.now()): string | null {
  const s = marbleStore();
  if (!s.round || s.round.id !== roundId) return null;
  if (roundStatus(s.round, now) === "RACING") return "레이스가 끝난 뒤에 닫을 수 있어요.";
  s.round = null;
  return null;
}

/** The round as shown (no invite token, no entry keys). */
export function marbleRoundView(now = Date.now()): MarbleRound | null {
  const r = marbleStore().round;
  if (!r) return null;
  return {
    id: r.id,
    no: r.no,
    status: roundStatus(r, now),
    mode: r.mode,
    keyword: r.keyword,
    maxPlayers: r.maxPlayers,
    rule: marbleRuleLabel(r.winRule, r.winRank),
    entrants: r.entrants.map((e) => ({ id: e.id, name: e.name, source: e.source })),
    race: r.race && { startAt: r.race.startAt, finishAt: r.race.finishAt, map: r.race.map, order: [...r.race.order], skills: r.race.skills.map((x) => ({ ...x })), winnerId: r.race.winnerId }
  };
}

/** 회차별 결과 of races that are over, newest first. */
export const marbleHistory = (now = Date.now()) => marbleStore().history.filter((h) => Date.parse(h.at) <= now);

/** The open INVITE round's link path, or null. */
export function marbleInvitePath(now = Date.now()) {
  const r = marbleStore().round;
  return r?.inviteToken && roundStatus(r, now) === "OPEN" ? `/play/marble/${r.inviteToken}` : null;
}
