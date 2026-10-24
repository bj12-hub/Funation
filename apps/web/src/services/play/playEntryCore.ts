import { randomInt, randomUUID } from "node:crypto";
import { chatStore } from "@/services/broadcast/chatCore";
import { PLAY_NAME_MAX, type PlaySource } from "./playTypes";

/**
 * 시청자 참여 게임 entries (server-only), shared by 마블 룰렛 · 로얄 럼블: chat entries by keyword from the 통합 채팅 feed
 * and entries by name (operator, 초대 링크). Each game keeps its own round; these only touch its entrant list.
 */

export type StoredEntrant = { id: string; name: string; source: PlaySource; key: string; at: string };
/** What an entry needs of a round: its keyword, cap, the chat feed read so far and the entrants. */
export type EntryRound = { keyword: string; maxPlayers: number; chatSeq: number; entrants: StoredEntrant[] };

const iso = (ms: number) => new Date(ms).toISOString();

/** Chat entries since the round last read the feed: the keyword (alone or first) from each platform user once, up to the cap. */
export function syncChatEntries(r: EntryRound, idPrefix: string) {
  for (const m of chatStore().messages) {
    if (m.seq <= r.chatSeq) continue;
    r.chatSeq = m.seq;
    const text = m.text.trim();
    if (m.hidden || m.fromStudio || (text !== r.keyword && !text.startsWith(`${r.keyword} `))) continue;
    const key = `${m.platform}:${m.author.platformUserId}`;
    if (r.entrants.length >= r.maxPlayers || r.entrants.some((e) => e.key === key)) continue;
    r.entrants.push({ id: `${idPrefix}-${randomUUID().slice(0, 8)}`, name: m.author.displayName.trim().slice(0, PLAY_NAME_MAX) || "시청자", source: m.platform, key, at: m.receivedAt });
  }
}

/** Adds an entrant by name (operator or 초대 링크): unique by name, within the cap. Returns an error message, or null. */
export function addEntrantByName(r: EntryRound, input: { name: unknown; source: "MANUAL" | "INVITE"; idPrefix: string }, forbidden: string[], now: number): string | null {
  const n = typeof input.name === "string" ? input.name.trim() : "";
  if (!n || n.length > PLAY_NAME_MAX) return `이름은 1~${PLAY_NAME_MAX}자로 입력해 주세요.`;
  if (forbidden.some((w) => n.toLowerCase().includes(w))) return "사용할 수 없는 단어가 포함되어 있어요.";
  if (r.entrants.some((e) => e.name.toLowerCase() === n.toLowerCase())) return "이미 참가한 이름이에요.";
  if (r.entrants.length >= r.maxPlayers) return "참가 인원이 다 찼어요.";
  r.entrants.push({ id: `${input.idPrefix}-${randomUUID().slice(0, 8)}`, name: n, source: input.source, key: `${input.source}:${n.toLowerCase()}`, at: iso(now) });
  return null;
}

/** The 참가 명령어 as saved: no spaces, 1 ~ `max` characters. Null when it is not one. */
export const parseKeyword = (v: unknown, max: number) => {
  const keyword = typeof v === "string" ? v.trim() : "";
  return keyword && keyword.length <= max && !/\s/.test(keyword) ? keyword : null;
};

/** A server-random order (Fisher–Yates on node:crypto). */
export const shuffled = <T>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
