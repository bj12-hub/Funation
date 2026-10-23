import { randomUUID } from "node:crypto";
import { gameRunCounts, parseMultiplier } from "./crewCore";
import { drawIndex, effectPoints, gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_SPIN,
  SPIN_ITEMS_MAX,
  SPIN_LABEL_MAX,
  SPIN_MULTIPLIER_MAX,
  SPIN_POINTS_MAX,
  SPIN_WEIGHT_MAX,
  type SpinItem,
  type SpinLive,
  type SpinSettings,
  type SpinTally
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 스핀머신 (server-only) — code-first, StreamDonate 스핀머신 참고 (P2, a game on crewGameCore). A slot-machine reel of the
 * creator's items (배수 · 점수 더하기 · 문구 · 꽝, each with a 가중치). A 시그니처 후원 to a member spins it (자동), or the
 * operator does (수동). A 배수 multiplies the 기준 후원's points, fixed when drawn.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 스핀머신 settings (defaults until saved). */
export const spinSettingsOf = (channelId: string): SpinSettings => mockCrew.spinMachines?.[channelId] ?? DEFAULT_SPIN;

/**
 * Validates the settings. `signatureIds`: the signatures that exist (제외 must be among them). `knownItems`: the saved item
 * ids — an item keeps its id (runs and the reel refer to it); any other id is replaced.
 */
export function parseSpinSettings(input: unknown, forbidden: string[], signatureIds: string[], knownItems: string[]): SpinSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (!Array.isArray(v.items) || v.items.length > SPIN_ITEMS_MAX) return { message: `칸은 ${SPIN_ITEMS_MAX}개까지 만들 수 있어요.` };
  const items: SpinItem[] = [];
  for (const raw of v.items) {
    const x = rec(raw);
    const label = typeof x.label === "string" ? x.label.trim() : "";
    if (!label || label.length > SPIN_LABEL_MAX) return { message: `칸 이름을 1~${SPIN_LABEL_MAX}자로 입력해 주세요.` };
    if (!isInt(x.weight, 1, SPIN_WEIGHT_MAX)) return { message: `확률 가중치는 1~${SPIN_WEIGHT_MAX} 사이 정수예요.` };
    let value = 0;
    if (x.kind === "MULTIPLY") {
      const m = parseMultiplier(x.value, SPIN_MULTIPLIER_MAX);
      if (m === null || m <= 1) return { message: `배수는 1보다 크고 ${SPIN_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
      value = m;
    } else if (x.kind === "ADD") {
      if (!isInt(x.value, 1, SPIN_POINTS_MAX)) return { message: `더할 점수는 1 ~ ${SPIN_POINTS_MAX.toLocaleString("ko-KR")}점이에요.` };
      value = x.value;
    } else if (x.kind !== "TEXT" && x.kind !== "MISS") return { message: "칸 종류를 골라 주세요." };
    // Item names are shown on stream.
    if (forbidden.some((w) => label.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    const keep = typeof x.id === "string" && knownItems.includes(x.id) && !items.some((i) => i.id === x.id);
    items.push({ id: keep ? (x.id as string) : `sp-${randomUUID().slice(0, 8)}`, label, kind: x.kind, value, weight: x.weight });
  }
  return { ...common, items };
}

/** Spins once (the caller checks there are items) and queues the run on OBS `?spin`. */
export function runSpin(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const { items } = spinSettingsOf(b.channelId);
  const item = items[drawIndex(items.map((i) => i.weight))];
  return recordRun(b, { ...start, game: "SPIN", itemId: item.id, label: item.label, kind: item.kind, value: item.value, points: effectPoints(item.kind, item.value, start.basePoints) }, now);
}

/** 자동 스핀 (crewGameTriggers): once per 시그니처 후원 to a member, while 자동 is on and the reel has items. */
export function spinForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const s = spinSettingsOf(channelId);
  const t = s.items.length ? signatureTrigger(channelId, "SPIN", s, input) : null;
  if (t) runSpin(t.live, t.start);
}

/** BJ별 집계: shown 문구 results per member — columns in first-seen order, members by total (ties in crew order). */
function spinTally(b: MockBroadcast): SpinTally {
  const shown = (b.gameRuns ?? []).filter((r) => r.game === "SPIN" && r.kind === "TEXT" && gameRunCounts(b, r));
  const columns = [...new Set(shown.map((r) => r.label))];
  const counts = new Map<string, number[]>();
  for (const r of shown) {
    let row = counts.get(r.memberId);
    if (!row) counts.set(r.memberId, (row = columns.map(() => 0)));
    row[columns.indexOf(r.label)] += 1;
  }
  const crew = mockCrew.crews[b.channelId] ?? [];
  const order = (id: string) => {
    const i = crew.findIndex((m) => m.id === id);
    return i < 0 ? crew.length : i;
  };
  const rows = [...counts].map(([memberId, n]) => {
    const m = crew.find((x) => x.id === memberId);
    return { memberId, name: m?.name ?? "삭제된 멤버", color: m?.color ?? null, counts: n, total: n.reduce((s, c) => s + c, 0) };
  });
  return { columns, rows: rows.sort((x, y) => y.total - x.total || order(x.memberId) - order(y.memberId)) };
}

/** 스핀머신 of a broadcast: settings, the latest runs (newest first) and the 문구 tally. */
export const spinLive = (b: MockBroadcast): SpinLive => ({ settings: structuredClone(spinSettingsOf(b.channelId)), runs: gameRunsView(b, "SPIN"), tally: spinTally(b) });
