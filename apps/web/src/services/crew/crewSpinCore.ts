import { randomUUID } from "node:crypto";
import { mockSignatures } from "@/services/donations/signatureCore";
import { excelOf, extraPoints, gameRunCounts, isActiveMember, liveBroadcastOf, parseMultiplier, scoreFn } from "./crewCore";
import { drawIndex, gameRunView, recordRun, usedSources, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_SPIN,
  SPIN_ITEMS_MAX,
  SPIN_LABEL_MAX,
  SPIN_LEAD_SEC,
  SPIN_MULTIPLIER_MAX,
  SPIN_POINTS_MAX,
  SPIN_REEL_SEC,
  SPIN_RESULT_SEC,
  SPIN_RUNS_SHOWN,
  SPIN_TITLE_MAX,
  SPIN_WEIGHT_MAX,
  type SpinItem,
  type SpinLive,
  type SpinSettings,
  type SpinTally
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 스핀머신 (server-only) — code-first, StreamDonate 스핀머신 참고 (P2, the first game on crewGameCore). A slot-machine reel
 * of the creator's items (배수 · 점수 더하기 · 문구 · 꽝, each with a 가중치). A 시그니처 후원 to a member spins it (자동 스핀),
 * or the operator does (수동 스핀). A 배수 multiplies the 기준 후원's points, fixed when drawn.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 스핀머신 settings (defaults until saved). */
export const spinSettingsOf = (channelId: string): SpinSettings => mockCrew.spinMachines?.[channelId] ?? DEFAULT_SPIN;

/**
 * Validates the settings. `signatureIds`: the signatures that exist (제외 must be among them). `knownItems`: the saved item
 * ids — an item keeps its id (runs and the reel refer to it); any other id is replaced.
 */
export function parseSpinSettings(input: unknown, forbidden: string[], signatureIds: string[], knownItems: string[]): SpinSettings | { message: string } {
  const v = rec(input);
  const title = text(v.title);
  if (title.length > SPIN_TITLE_MAX) return { message: `제목은 ${SPIN_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (!Array.isArray(v.items) || v.items.length > SPIN_ITEMS_MAX) return { message: `칸은 ${SPIN_ITEMS_MAX}개까지 만들 수 있어요.` };
  const items: SpinItem[] = [];
  for (const raw of v.items) {
    const x = rec(raw);
    const label = text(x.label);
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
    const keep = typeof x.id === "string" && knownItems.includes(x.id) && !items.some((i) => i.id === x.id);
    items.push({ id: keep ? (x.id as string) : `sp-${randomUUID().slice(0, 8)}`, label, kind: x.kind, value, weight: x.weight });
  }
  if (!Array.isArray(v.excluded) || v.excluded.some((id) => typeof id !== "string" || !signatureIds.includes(id))) return { message: "제외할 시그니처를 확인해 주세요." };
  if (typeof v.auto !== "boolean" || typeof v.showIdle !== "boolean") return { message: "설정을 확인해 주세요." };
  // Everything here is shown on stream.
  const words = [title, ...items.map((i) => i.label)].map((s) => s.toLowerCase());
  if (words.some((s) => forbidden.some((w) => s.includes(w)))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  return { title, items, auto: v.auto, excluded: [...new Set(v.excluded as string[])], showIdle: v.showIdle };
}

/** Points a drawn item adds for a 기준 후원 worth `base` points (배수: (배수 − 1) × base, rounded once). */
export const spinPoints = (item: Pick<SpinItem, "kind" | "value">, base: number) => (item.kind === "MULTIPLY" ? extraPoints(base, item.value) : item.kind === "ADD" ? item.value : 0);

/** Spins once for a member (the caller checks there are items) and queues the run on OBS. */
export function runSpin(b: MockBroadcast, input: Pick<StoredRun, "id" | "memberId" | "trigger" | "sourceId" | "basePoints">, now = Date.now()): StoredRun {
  const { items } = spinSettingsOf(b.channelId);
  const item = items[drawIndex(items.map((i) => i.weight))];
  return recordRun(
    b,
    { ...input, game: "SPIN", at: new Date(now).toISOString(), itemId: item.id, label: item.label, kind: item.kind, value: item.value, points: spinPoints(item, input.basePoints) },
    { leadSec: SPIN_LEAD_SEC, reelSec: SPIN_REEL_SEC, resultSec: SPIN_RESULT_SEC }
  );
}

/**
 * 자동 스핀 — called by the Donation Core once a completed donation is credited to a member: a 시그니처 후원 (or a 일반 후원
 * that alerted as a signature by 금액 일치 · 금액범위) spins once while a crew broadcast is live — not when 자동 스핀 is off,
 * the reel is empty or the signature is excluded. The donation is the 기준 후원.
 */
export function spinForSignature(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number }) {
  const live = liveBroadcastOf(channelId);
  const s = spinSettingsOf(channelId);
  if (!live || !input.memberId || !input.signatureId || !s.auto || !s.items.length || s.excluded.includes(input.signatureId)) return;
  if (!isActiveMember(channelId, input.memberId) || usedSources(live, "SPIN").has(input.donationId)) return;
  const signatureName = mockSignatures.items.find((x) => x.id === input.signatureId)?.name ?? "시그니처";
  runSpin(live, {
    id: `spin-${input.donationId}`,
    memberId: input.memberId,
    trigger: { kind: "SIGNATURE", signatureId: input.signatureId, signatureName },
    sourceId: input.donationId,
    basePoints: scoreFn(input.fnAmount, excelOf(channelId))
  });
}

/** BJ별 집계: shown 문구 results per member — columns in first-seen order, members by total (ties in crew order). */
function spinTally(b: MockBroadcast, runs: StoredRun[]): SpinTally {
  const shown = runs.filter((r) => r.kind === "TEXT" && gameRunCounts(b, r));
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
export function spinLive(b: MockBroadcast): SpinLive {
  const runs = (b.gameRuns ?? []).filter((r) => r.game === "SPIN");
  return {
    settings: structuredClone(spinSettingsOf(b.channelId)),
    runs: runs
      .slice(-SPIN_RUNS_SHOWN)
      .reverse()
      .map((r) => gameRunView(b, r)),
    tally: spinTally(b, runs)
  };
}
