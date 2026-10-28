import { randomUUID } from "node:crypto";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { drawIndex, gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_SUDOPOLY,
  SUDOPOLY_CHARACTERS,
  SUDOPOLY_ISLAND_MAX,
  SUDOPOLY_KEYS_MAX,
  SUDOPOLY_KEY_KINDS,
  SUDOPOLY_KEY_LABEL_MAX,
  SUDOPOLY_LABEL_MAX,
  SUDOPOLY_LAPS_MAX,
  SUDOPOLY_MOVE_MAX,
  SUDOPOLY_PIECE_MODES,
  SUDOPOLY_POINTS_MAX,
  SUDOPOLY_ROLLS_MAX,
  SUDOPOLY_SPACES_MAX,
  SUDOPOLY_SPACES_MIN,
  SUDOPOLY_SPACE_KINDS,
  SUDOPOLY_TIERS_MAX,
  SUDOPOLY_WEIGHT_MAX,
  type SudopolyKey,
  type SudopolyLive,
  type SudopolySettings,
  type SudopolySpace,
  type SudopolyTier
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 스도폴리 (server-only) — code-first, StreamDonate 스도폴리 참고 (부루마불형, a game on crewGameCore). Pieces (BJ별 말 or one
 * 공용 말) go round a square loop of 칸 on two dice rolled by the server. A 시그니처 후원 to a member rolls as many times as its
 * 금액 구간 gives (자동), the operator rolls once (수동); each roll is a run on OBS `?sudopoly` with the points it made for
 * the member: 출발 보너스 for passing 출발, a 점수 칸, a 황금열쇠 card, the 목표 바퀴 bonus. 무인도 sits out rolls (a 더블
 * gets out); a 더블 rolls again, three in a row go to 무인도.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isPoints = (v: unknown): v is number => isInt(v, -SUDOPOLY_POINTS_MAX, SUDOPOLY_POINTS_MAX) && v !== 0;

/** The channel's 스도폴리 settings (defaults until saved; settings from before 참여 BJ · 캐릭터 read with everyone playing). */
export const sudopolySettingsOf = (channelId: string): SudopolySettings => ({ ...DEFAULT_SUDOPOLY, ...mockCrew.sudopolys?.[channelId] });

/**
 * Validates the settings: no 칸 yet (nothing rolls) or 8 ~ 40 칸 in fours, the first the only 출발; a 황금열쇠 칸 needs cards,
 * a 무인도로 card a 무인도 칸. `known`: the saved ids of 칸 · cards · 구간 (kept); any other id is replaced. Labels are shown
 * on stream (금지어). 금액 구간 are kept from the lowest up.
 */
export function parseSudopolySettings(
  input: unknown,
  forbidden: string[],
  signatureIds: string[],
  known: { spaces: string[]; keys: string[]; tiers: string[] },
  memberIds: string[] = []
): SudopolySettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const banned = (text: string) => forbidden.some((w) => text.toLowerCase().includes(w));
  const keepId = (id: unknown, ids: string[], used: { id: string }[], prefix: string) =>
    typeof id === "string" && ids.includes(id) && !used.some((x) => x.id === id) ? id : `${prefix}-${randomUUID().slice(0, 8)}`;
  const pieceMode = SUDOPOLY_PIECE_MODES.find((m) => m.key === v.pieceMode)?.key;
  if (!pieceMode) return { message: "말 방식을 골라 주세요." };

  if (!Array.isArray(v.spaces) || (v.spaces.length > 0 && (v.spaces.length < SUDOPOLY_SPACES_MIN || v.spaces.length > SUDOPOLY_SPACES_MAX || v.spaces.length % 4 !== 0)))
    return { message: `칸은 ${SUDOPOLY_SPACES_MIN} ~ ${SUDOPOLY_SPACES_MAX}개, 4의 배수로 만들어 주세요.` };
  const spaces: SudopolySpace[] = [];
  for (const [i, raw] of v.spaces.entries()) {
    const x = rec(raw);
    const kind = SUDOPOLY_SPACE_KINDS.find((k) => k.key === x.kind)?.key;
    if (!kind) return { message: `${i + 1}번 칸 종류를 골라 주세요.` };
    if ((i === 0) !== (kind === "START")) return { message: "첫 칸만 출발이에요." };
    const label = typeof x.label === "string" ? x.label.trim() : "";
    if (!label || label.length > SUDOPOLY_LABEL_MAX) return { message: `${i + 1}번 칸 이름은 1~${SUDOPOLY_LABEL_MAX}자로 입력해 주세요.` };
    if (banned(label)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (kind === "POINTS" && !isPoints(x.value)) return { message: `${i + 1}번 칸 점수는 ±${SUDOPOLY_POINTS_MAX.toLocaleString("ko-KR")}점 안에서 0이 아니게 정해 주세요.` };
    spaces.push({ id: keepId(x.id, known.spaces, spaces, "sp"), kind, label, value: kind === "POINTS" ? (x.value as number) : 0 });
  }
  const hasIsland = spaces.some((x) => x.kind === "ISLAND");

  if (!Array.isArray(v.keys) || v.keys.length > SUDOPOLY_KEYS_MAX) return { message: `황금열쇠 카드는 ${SUDOPOLY_KEYS_MAX}장까지 넣을 수 있어요.` };
  const keys: SudopolyKey[] = [];
  for (const raw of v.keys) {
    const x = rec(raw);
    const kind = SUDOPOLY_KEY_KINDS.find((k) => k.key === x.kind)?.key;
    if (!kind) return { message: "황금열쇠 카드 종류를 골라 주세요." };
    const label = typeof x.label === "string" ? x.label.trim() : "";
    if (!label || label.length > SUDOPOLY_KEY_LABEL_MAX) return { message: `황금열쇠 문구는 1~${SUDOPOLY_KEY_LABEL_MAX}자로 입력해 주세요.` };
    if (banned(label)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (kind === "POINTS" && !isPoints(x.value)) return { message: `황금열쇠 점수는 ±${SUDOPOLY_POINTS_MAX.toLocaleString("ko-KR")}점 안에서 0이 아니게 정해 주세요.` };
    if (kind === "MOVE" && !(isInt(x.value, -SUDOPOLY_MOVE_MAX, SUDOPOLY_MOVE_MAX) && x.value !== 0)) return { message: `황금열쇠 이동은 ±${SUDOPOLY_MOVE_MAX}칸 안에서 0이 아니게 정해 주세요.` };
    if (kind === "ISLAND" && !hasIsland) return { message: "무인도 칸이 없어 '무인도로' 카드를 쓸 수 없어요." };
    if (!isInt(x.weight, 1, SUDOPOLY_WEIGHT_MAX)) return { message: `황금열쇠 가중치는 1 ~ ${SUDOPOLY_WEIGHT_MAX} 사이 정수예요.` };
    keys.push({ id: keepId(x.id, known.keys, keys, "sk"), label, kind, value: kind === "POINTS" || kind === "MOVE" ? (x.value as number) : 0, weight: x.weight });
  }
  if (spaces.some((x) => x.kind === "KEY") && !keys.length) return { message: "황금열쇠 칸이 있으면 카드를 1장 이상 넣어 주세요." };

  if (!Array.isArray(v.tiers) || v.tiers.length > SUDOPOLY_TIERS_MAX) return { message: `금액 구간은 ${SUDOPOLY_TIERS_MAX}개까지 만들 수 있어요.` };
  const tiers: SudopolyTier[] = [];
  for (const raw of v.tiers) {
    const x = rec(raw);
    if (!isInt(x.min, 0, SIGNATURE_LIMITS.priceMax) || !isInt(x.rolls, 1, SUDOPOLY_ROLLS_MAX)) return { message: `금액 구간은 최소 금액과 굴림 1 ~ ${SUDOPOLY_ROLLS_MAX}번으로 정해 주세요.` };
    if (tiers.some((t) => t.min === x.min)) return { message: "금액 구간의 최소 금액이 겹쳐요." };
    tiers.push({ id: keepId(x.id, known.tiers, tiers, "st"), min: x.min, rolls: x.rolls });
  }

  if (!isInt(v.startBonus, 0, SUDOPOLY_POINTS_MAX)) return { message: `출발 보너스는 0 ~ ${SUDOPOLY_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
  if (!isInt(v.islandTurns, 1, SUDOPOLY_ISLAND_MAX)) return { message: `무인도는 1 ~ ${SUDOPOLY_ISLAND_MAX}번 쉬어요.` };
  if (!isInt(v.goalLaps, 0, SUDOPOLY_LAPS_MAX)) return { message: `목표 바퀴는 0 ~ ${SUDOPOLY_LAPS_MAX}바퀴예요(0이면 없음).` };
  if (!isInt(v.goalBonus, 0, SUDOPOLY_POINTS_MAX)) return { message: `완주 보너스는 0 ~ ${SUDOPOLY_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
  // 참여 BJ · 캐릭터 (2026-10-28): a screen from before sends neither (everyone plays, initials); a member removed since drops out.
  const sitOutRaw = v.sitOut === undefined ? [] : v.sitOut;
  if (!Array.isArray(sitOutRaw) || sitOutRaw.some((id) => typeof id !== "string")) return { message: "참여 BJ를 확인해 주세요." };
  const sitOut = [...new Set(sitOutRaw as string[])].filter((id) => memberIds.includes(id));
  const charactersRaw = v.characters === undefined ? {} : v.characters;
  if (typeof charactersRaw !== "object" || charactersRaw === null || Array.isArray(charactersRaw)) return { message: "캐릭터를 다시 골라 주세요." };
  const characters: Record<string, string> = {};
  for (const [id, key] of Object.entries(charactersRaw)) {
    if (!SUDOPOLY_CHARACTERS.some((c) => c.key === key)) return { message: "캐릭터를 다시 골라 주세요." };
    if (memberIds.includes(id)) characters[id] = key as string;
  }
  return {
    ...common,
    pieceMode,
    sitOut,
    characters,
    spaces,
    startBonus: v.startBonus,
    islandTurns: v.islandTurns,
    keys,
    tiers: tiers.sort((x, y) => x.min - y.min),
    goalLaps: v.goalLaps,
    goalBonus: v.goalBonus
  };
}

/** The rolls a 시그니처 후원 of `amount` FN gives: the highest 금액 구간 it reaches (0 below them all). */
export const sudopolyRolls = (tiers: SudopolyTier[], amount: number) => [...tiers].sort((x, y) => y.min - x.min).find((t) => amount >= t.min)?.rolls ?? 0;

const rollDie = () => drawIndex([1, 1, 1, 1, 1, 1]) + 1;

/**
 * Rolls `rolls` times (and again on each 더블) for `start.memberId`'s piece — the 공용 말 in that mode — and queues a run per
 * roll on OBS `?sudopoly` (the caller checks the board has 칸). Returns the first run.
 */
export function runSudopoly(b: MockBroadcast, start: RunStart, now = Date.now(), rolls = 1): StoredRun {
  const s = sudopolySettingsOf(b.channelId);
  const n = s.spaces.length;
  const key = s.pieceMode === "SHARED" ? "SHARED" : start.memberId;
  const piece = ((b.sudopoly ??= { pieces: {} }).pieces[key] ??= { pos: 0, laps: 0, island: 0 });
  piece.pos %= n; // the board may have fewer 칸 since
  const islandAt = s.spaces.findIndex((x) => x.kind === "ISLAND");
  let first: StoredRun | undefined;
  let left = rolls;
  let doubles = 0;
  for (let seq = 0; left > 0; seq++) {
    left -= 1;
    const dice: [number, number] = [rollDie(), rollDie()];
    const double = dice[0] === dice[1];
    const from = piece.pos;
    const notes: string[] = [];
    let points = 0;
    let label: string;
    // Forward past 출발: 출발 보너스 each time, and laps toward the 목표 (going back passes nothing).
    const move = (steps: number) => {
      const to = piece.pos + steps;
      if (steps > 0 && to >= n) {
        const laps = Math.floor(to / n);
        piece.laps += laps;
        if (s.startBonus) {
          points += s.startBonus * laps;
          notes.push("출발 보너스");
        }
        if (s.goalLaps && piece.laps >= s.goalLaps) {
          piece.laps -= s.goalLaps;
          points += s.goalBonus;
          notes.push(`${s.goalLaps}바퀴 완주`);
        }
      }
      piece.pos = ((to % n) + n) % n;
    };
    const toIsland = () => {
      piece.pos = islandAt;
      piece.island = s.islandTurns;
    };
    if (piece.island > 0 && !double) {
      piece.island -= 1;
      label = `무인도 (남은 ${piece.island}번)`;
    } else {
      const escaped = piece.island > 0;
      piece.island = 0;
      if (double) doubles += 1;
      if (double && doubles >= 3 && islandAt >= 0) {
        toIsland();
        label = "더블 3번 · 무인도로";
      } else {
        if (escaped) notes.push("무인도 탈출");
        move(dice[0] + dice[1]);
        const space = s.spaces[piece.pos];
        label = space.label;
        if (space.kind === "POINTS") points += space.value;
        else if (space.kind === "ISLAND") piece.island = s.islandTurns;
        else if (space.kind === "KEY" && s.keys.length) {
          const card = s.keys[drawIndex(s.keys.map((k) => k.weight))];
          label = `황금열쇠 · ${card.label}`;
          if (card.kind === "POINTS") points += card.value;
          else if (card.kind === "MOVE") move(card.value);
          else if (card.kind === "START") move(n - piece.pos);
          else if (card.kind === "ISLAND" && islandAt >= 0) toIsland();
        }
        // 더블: once more (not when it got the piece off 무인도, nor a third in a row).
        if (double && !escaped && doubles < 3) left += 1;
      }
    }
    const run = recordRun(
      b,
      {
        ...start,
        id: seq === 0 ? start.id : `${start.id}-${seq}`,
        game: "SUDOPOLY",
        itemId: s.spaces[piece.pos].id,
        dice,
        label: [label, ...notes].join(" · "),
        kind: points ? "ADD" : "TEXT",
        value: points,
        points,
        move: { piece: key, from, to: piece.pos, laps: piece.laps }
      },
      now
    );
    first ??= run;
  }
  return first!;
}

/** 자동 (crewGameTriggers): a 시그니처 후원 to a member rolls as many times as its 금액 구간 gives, while 자동 is on and the board has 칸. */
export function sudopolyForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const s = sudopolySettingsOf(channelId);
  if (s.pieceMode === "MEMBER" && input.memberId && s.sitOut.includes(input.memberId)) return; // 참여하지 않는 BJ
  const rolls = s.spaces.length ? sudopolyRolls(s.tiers, input.fnAmount) : 0;
  const t = rolls ? signatureTrigger(channelId, "SUDOPOLY", s, input) : null;
  if (t) runSudopoly(t.live, t.start, Date.now(), rolls);
}

/** 판 다시 시작: every piece back on 출발 (no laps, no 무인도). */
export function resetSudopolyBoard(b: MockBroadcast) {
  b.sudopoly = { pieces: {} };
}

export function sudopolyLive(b: MockBroadcast): SudopolyLive {
  const s = sudopolySettingsOf(b.channelId);
  const pieces = b.sudopoly?.pieces ?? {};
  const at = (key: string) => {
    const p = pieces[key] ?? { pos: 0, laps: 0, island: 0 };
    return { pos: s.spaces.length ? p.pos % s.spaces.length : 0, laps: p.laps, island: p.island };
  };
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "SUDOPOLY"),
    pieces:
      s.pieceMode === "SHARED"
        ? [{ key: "SHARED", name: "공용 말", color: null, emoji: null, ...at("SHARED") }]
        : (mockCrew.crews[b.channelId] ?? [])
            .filter((m) => !s.sitOut.includes(m.id) && (m.active || pieces[m.id]))
            .map((m) => ({ key: m.id, name: m.name, color: m.color, emoji: SUDOPOLY_CHARACTERS.find((c) => c.key === s.characters[m.id])?.emoji ?? null, ...at(m.id) }))
  };
}
