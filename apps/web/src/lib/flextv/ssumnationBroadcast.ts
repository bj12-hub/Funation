import { QUEST_STATUSES, type QuestStatus } from "@/services/creator/donationManagementTypes";
import { DEFAULT_WIDGET_SETTINGS } from "@/services/creator/widgetSettingsTypes";
import type { MiniLine } from "@/services/creator/widgetOverlayTypes";
import type { GachaBoardView, GachaControlResult, GachaDrawStatus, GachaRemoteView, GachaRow, GachaStage } from "@/services/donations/gachaTypes";
import type { QuestDecideResult, QuestExtendResult } from "@/services/donations/questTypes";
import type { RouletteControlResult, RouletteRemoteRow, RouletteRemoteView, RouletteSpinStatus, RouletteStage } from "@/services/donations/rouletteTypes";
import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";

/**
 * The second half of FLEXTV's Ssumnation endpoints (phase 6, docs/development/flextv-ssumnation-api.md §6–§9): 퀘스트
 * decisions and extensions, the supporter's and the streamer's lists, the 리모컨's 룰렛 · 뽑기, and the OBS overlays'
 * key and state — read into Ssumnation's own types so its screens work unchanged. Pure readers are tested in
 * `ssumnationBroadcast.test.ts`.
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const whole = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const id = (value: unknown) => (typeof value === "string" || typeof value === "number" ? (/^[\w-]{1,40}$/.test(String(value)) ? String(value) : null) : null);
const time = (value: unknown) => (typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null);
const rows = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
const short = (value: unknown) => (typeof value === "string" && value.length <= 100 && /[가-힣]/.test(value) ? value : null);
const questStatus = (value: unknown): QuestStatus | null => QUEST_STATUSES.find((s) => s.key === value)?.key ?? null;
const unavailable = (what: string, status: number) => new FlextvUnavailableError(`FLEXTV ${what} answered ${status}`);

/* ── 퀘스트 (§6) ─────────────────────────────────────────── */

export type QuestDecision = "SUCCESS" | "FAILED" | "CANCELED";

export function mapDecision({ status, data }: Pick<FlextvResponse, "status" | "data">): QuestDecideResult {
  if (status === 401) return { status: "UNAUTHORIZED" };
  if (status === 403) return { status: "FORBIDDEN" };
  if (status === 404) return { status: "NOT_FOUND" };
  if (status >= 500 || !isRecord(data)) throw unavailable("quest decision", status);
  const decided = questStatus(data.questStatus);
  if (data.status === "OK" && decided) return { status: "OK", questStatus: decided, refundedFn: whole(data.refundedAmount) ?? 0 };
  if (data.status === "ALREADY_DECIDED" && decided) return { status: "ALREADY_DECIDED", questStatus: decided };
  if (status === 400) return { status: "INVALID" };
  throw unavailable("quest decision", status);
}

export async function decideQuest(token: string, context: DeviceContext, questId: string, decision: QuestDecision): Promise<QuestDecideResult> {
  if (!id(questId)) return { status: "NOT_FOUND" };
  return mapDecision(await flextvRequest(`/api/ssumnation/quests/${questId}/decision`, { method: "POST", token, ...requestFrom(context), body: { decision } }));
}

export function mapExtension({ status, data }: Pick<FlextvResponse, "status" | "data">): QuestExtendResult {
  if (status === 401 || status === 403) return { status: "UNAUTHORIZED" };
  if (status === 404) return { status: "NOT_FOUND" };
  if (status >= 500 || !isRecord(data)) throw unavailable("quest extension", status);
  if (data.status === "OK") {
    const minutes = whole(data.minutes);
    const endsAt = time(data.endsAt);
    if (minutes === null || !endsAt) throw unavailable("quest extension", status);
    return { status: "OK", minutes, endsAt, restarted: data.restarted === true };
  }
  if (data.status === "ALREADY_DECIDED" && questStatus(data.questStatus)) return { status: "ALREADY_DECIDED", questStatus: questStatus(data.questStatus)! };
  if (data.status === "DISABLED") return { status: "DISABLED" };
  return { status: "INVALID", message: short(data.message) ?? "시간을 연장하지 못했어요." };
}

export async function extendQuest(token: string, context: DeviceContext, questId: string, minutes: number, requestId: string): Promise<QuestExtendResult> {
  if (!id(questId)) return { status: "NOT_FOUND" };
  return mapExtension(await flextvRequest(`/api/ssumnation/quests/${questId}/extension`, { method: "POST", token, ...requestFrom(context), body: { minutes, requestId } }));
}

/* ── Lists (§7) ──────────────────────────────────────────── */

export type ChannelQuest = {
  id: string;
  donorNickname: string;
  title: string;
  amount: number;
  status: QuestStatus;
  createdAt: string;
  decidedAt: string | null;
  endsAt: string;
  extendedMin: number;
  creatorDecides: boolean;
};

export type ChannelQuestPage = { items: ChannelQuest[]; count: number; held: { amount: number; count: number }; allowExtension: boolean; serverNow: string };

export function readChannelQuests(data: unknown): ChannelQuestPage {
  const body = isRecord(data) ? data : {};
  const items = rows(body.data).flatMap((q): ChannelQuest[] => {
    const questId = id(q.id);
    const status = questStatus(q.status);
    const createdAt = time(q.createdAt);
    const endsAt = time(q.endsAt);
    if (!questId || !status || !createdAt || !endsAt) return [];
    return [
      {
        id: questId,
        donorNickname: text(q.donorNickname) || "알 수 없음",
        title: text(q.title),
        amount: whole(q.amount) ?? 0,
        status,
        createdAt,
        decidedAt: time(q.decidedAt),
        endsAt,
        extendedMin: whole(q.extendedMin) ?? 0,
        creatorDecides: q.creatorDecides === true
      }
    ];
  });
  const held = isRecord(body.held) ? body.held : {};
  return {
    items,
    count: whole(body.count) ?? items.length,
    held: { amount: whole(held.amount) ?? 0, count: whole(held.count) ?? 0 },
    allowExtension: body.allowExtension === true,
    serverNow: time(body.serverNow) ?? new Date().toISOString()
  };
}

export async function fetchChannelQuests(token: string, { status, offset, limit }: { status: QuestStatus | "ALL"; offset: number; limit: number }): Promise<ChannelQuestPage | null> {
  const response = await flextvRequest(`/api/ssumnation/my/channel/quests?status=${status}&offset=${Math.max(0, offset)}&limit=${Math.min(50, Math.max(1, limit))}`, { token });
  if (response.status === 401 || response.status === 403) return null;
  if (response.status !== 200) throw unavailable("channel quests", response.status);
  return readChannelQuests(response.data);
}

export type MyFlextvDonation = {
  id: string;
  donatedAt: string;
  channelId: string;
  channelName: string;
  type: string;
  amount: number;
  message: string;
  status: "COMPLETED" | "PROCESSING" | "REFUNDED";
  refundedAt: string | null;
  quest: { id: string; status: QuestStatus; endsAt: string; extendedMin: number } | null;
  game: { kind: "ROULETTE" | "GACHA"; status: string; result: string | null; blank: boolean | null } | null;
};

export function readMyDonations(data: unknown): { items: MyFlextvDonation[]; count: number } {
  const body = isRecord(data) ? data : {};
  const items = rows(body.data).flatMap((d): MyFlextvDonation[] => {
    const donationId = id(d.id);
    const donatedAt = time(d.donatedAt);
    const status = d.status === "COMPLETED" || d.status === "PROCESSING" || d.status === "REFUNDED" ? d.status : null;
    if (!donationId || !donatedAt || !status) return [];
    const q = isRecord(d.quest) ? d.quest : null;
    const qStatus = q ? questStatus(q.status) : null;
    const g = isRecord(d.game) ? d.game : null;
    const kind = g?.kind === "ROULETTE" || g?.kind === "GACHA" ? g.kind : null;
    return [
      {
        id: donationId,
        donatedAt,
        channelId: id(d.channelId) ?? "",
        channelName: text(d.channelName),
        type: text(d.type),
        amount: whole(d.amount) ?? 0,
        message: text(d.message),
        status,
        refundedAt: time(d.refundedAt),
        quest: q && qStatus && id(q.id) && time(q.endsAt) ? { id: id(q.id)!, status: qStatus, endsAt: time(q.endsAt)!, extendedMin: whole(q.extendedMin) ?? 0 } : null,
        game: g && kind ? { kind, status: text(g.status), result: typeof g.result === "string" && g.result ? g.result : null, blank: typeof g.blank === "boolean" ? g.blank : null } : null
      }
    ];
  });
  return { items, count: whole(body.count) ?? items.length };
}

export async function fetchMyDonations(token: string, { category, offset, limit }: { category: "quest" | "game"; offset: number; limit: number }) {
  const response = await flextvRequest(`/api/ssumnation/my/donations?category=${category}&offset=${Math.max(0, offset)}&limit=${Math.min(50, Math.max(1, limit))}`, { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw unavailable("my donations", response.status);
  return readMyDonations(response.data);
}

/** 후원 내역's 게임 후원 line, worded as the mock's (services/wallet/walletHistory.ts `gameResultOf`). */
export function gameResultText(game: NonNullable<MyFlextvDonation["game"]>): string {
  const name = game.kind === "ROULETTE" ? "룰렛" : "뽑기";
  if ((game.status === "RESULT" || game.status === "DONE") && game.result) return game.blank || game.result === "꽝" ? `${name} 결과 · 꽝` : `${name} 결과 · ${game.result} 당첨`;
  if (game.status === "QUEUED") return game.kind === "ROULETTE" ? "룰렛 대기 중" : "뽑기 실행 대기";
  if (game.status === "WAITING") return "룰렛 결과 대기";
  return game.kind === "ROULETTE" ? "룰렛 회전 중" : "뽑는 중";
}

/* ── 리모컨 (§8) ─────────────────────────────────────────── */

const SPIN = ["QUEUED", "SPINNING", "WAITING", "RESULT", "DONE"] as const;
const DRAW = ["QUEUED", "SPINNING", "RESULT", "DONE"] as const;
const GACHA_LOOK = DEFAULT_WIDGET_SETTINGS.GACHA.gachas[0];
const items = (value: unknown) => rows(value).flatMap((i) => (text(i.name) && (num(i.percent) ?? 0) > 0 ? [{ name: text(i.name), percent: num(i.percent)! }] : []));

function readSpinRow(r: Record<string, unknown>): RouletteRemoteRow | null {
  const spinId = id(r.id);
  const status = SPIN.find((s) => s === r.status) as RouletteSpinStatus | undefined;
  const createdAt = time(r.createdAt);
  if (!spinId || !status || !createdAt) return null;
  return { id: spinId, no: text(r.no) || spinId, donor: text(r.donor), amount: whole(r.amount) ?? 0, createdAt, nth: whole(r.nth) ?? 0, status, result: status === "RESULT" || status === "DONE" ? text(r.result) || null : null };
}

export function readRouletteStage(value: unknown): RouletteStage | null {
  if (!isRecord(value)) return null;
  const stageId = id(value.id);
  const status = value.status === "SPINNING" || value.status === "WAITING" || value.status === "RESULT" ? value.status : null;
  const endsAt = time(value.endsAt);
  if (!stageId || !status || !endsAt) return null;
  return {
    id: stageId,
    no: text(value.no) || stageId,
    status,
    donor: text(value.donor),
    amount: whole(value.amount) ?? 0,
    items: items(value.items),
    nth: whole(value.nth) ?? 0,
    limit: whole(value.limit) ?? 0,
    result: status === "RESULT" ? text(value.result) || null : null,
    endsAt
  };
}

export function readRouletteRemote(data: unknown): RouletteRemoteView {
  const b = isRecord(data) ? data : {};
  return {
    enabled: b.enabled === true,
    autoStart: b.autoStart === true,
    autoReveal: b.autoReveal !== false,
    paused: b.paused === true,
    hidden: b.hidden === true,
    dailyLimit: whole(b.dailyLimit) ?? 0,
    items: items(b.items),
    stage: readRouletteStage(b.stage),
    queue: rows(b.queue).flatMap((r) => readSpinRow(r) ?? []),
    recent: rows(b.recent).flatMap((r) => readSpinRow(r) ?? []),
    participantsToday: whole(b.participantsToday) ?? 0
  };
}

function readDrawRow(r: Record<string, unknown>): GachaRow | null {
  const drawId = id(r.id);
  const status = DRAW.find((s) => s === r.status) as GachaDrawStatus | undefined;
  const createdAt = time(r.createdAt);
  if (!drawId || !status || !createdAt) return null;
  const shown = status === "RESULT" || status === "DONE";
  const blank = shown && typeof r.blank === "boolean" ? r.blank : null;
  return {
    id: drawId,
    no: text(r.no) || drawId,
    gachaName: text(r.gachaName),
    donor: text(r.donor),
    amount: whole(r.amount) ?? 0,
    createdAt,
    status,
    prize: shown ? text(r.prize) || null : null,
    blank,
    claimed: shown && blank === false && typeof r.claimed === "boolean" ? r.claimed : null
  };
}

/** The 뽑기 machine's look is Ssumnation's default (FLEXTV keeps no design). */
export function readGachaStage(value: unknown): GachaStage | null {
  if (!isRecord(value)) return null;
  const stageId = id(value.id);
  const status = value.status === "SPINNING" || value.status === "RESULT" ? value.status : null;
  const endsAt = time(value.endsAt);
  if (!stageId || !status || !endsAt) return null;
  return {
    id: stageId,
    no: text(value.no) || stageId,
    status,
    gachaName: text(value.gachaName),
    style: GACHA_LOOK.style,
    pointColor: GACHA_LOOK.pointColor,
    donor: text(value.donor),
    amount: whole(value.amount) ?? 0,
    message: text(value.message),
    prize: status === "RESULT" ? text(value.prize) || null : null,
    blank: status === "RESULT" && typeof value.blank === "boolean" ? value.blank : null,
    endsAt
  };
}

export function readGachaRemote(data: unknown): GachaRemoteView {
  const b = isRecord(data) ? data : {};
  return {
    stage: readGachaStage(b.stage),
    queue: rows(b.queue).flatMap((r) => readDrawRow(r) ?? []),
    recent: rows(b.recent).flatMap((r) => readDrawRow(r) ?? []),
    unclaimed: whole(b.unclaimed) ?? 0,
    hidden: b.hidden === true
  };
}

export async function fetchRouletteRemote(token: string): Promise<RouletteRemoteView | null> {
  const response = await flextvRequest("/api/ssumnation/my/games/roulette", { token });
  if (response.status === 401 || response.status === 403) return null;
  if (response.status !== 200) throw unavailable("roulette remote", response.status);
  return readRouletteRemote(response.data);
}

export async function fetchGachaRemote(token: string): Promise<GachaRemoteView | null> {
  const response = await flextvRequest("/api/ssumnation/my/games/gacha", { token });
  if (response.status === 401 || response.status === 403) return null;
  if (response.status !== 200) throw unavailable("gacha remote", response.status);
  return readGachaRemote(response.data);
}

export function mapControl({ status, data }: Pick<FlextvResponse, "status" | "data">): RouletteControlResult & GachaControlResult {
  if (status === 401 || status === 403) return { status: "UNAUTHORIZED" };
  if (status >= 500 || !isRecord(data)) throw unavailable("game control", status);
  if (data.status === "SAVED") return { status: "SAVED" };
  return { status: "INVALID", message: short(data.message) ?? "지금은 할 수 없어요. 화면을 새로고침해 주세요." };
}

export type RouletteAction =
  | { action: "START_NEXT" | "PAUSE" | "RESUME" | "HIDE" | "SHOW" }
  | { action: "REVEAL" | "FINISH"; spinId: string }
  | { action: "SWITCH"; key: "enabled" | "autoStart" | "autoReveal"; on: boolean };
export type GachaAction = { action: "HIDE" | "SHOW" } | { action: "FINISH" | "CLAIM" | "UNCLAIM"; drawId: string };

export async function controlRoulette(token: string, context: DeviceContext, body: RouletteAction): Promise<RouletteControlResult> {
  return mapControl(await flextvRequest("/api/ssumnation/my/games/roulette", { method: "POST", token, ...requestFrom(context), body }));
}

export async function controlGacha(token: string, context: DeviceContext, body: GachaAction): Promise<GachaControlResult> {
  return mapControl(await flextvRequest("/api/ssumnation/my/games/gacha", { method: "POST", token, ...requestFrom(context), body }));
}

/* ── OBS overlays (§9) ───────────────────────────────────── */

export const isOverlayKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9-]{16,64}$/.test(value);

export async function fetchOverlayKey(token: string, context: DeviceContext | null, reissue = false): Promise<string | null> {
  const response = await flextvRequest("/api/ssumnation/my/overlay-key", reissue && context ? { method: "POST", token, ...requestFrom(context) } : { token });
  if (response.status === 401 || response.status === 403) return null;
  const key = isRecord(response.data) ? response.data.key : null;
  if (response.status !== 200 || !isOverlayKey(key)) throw unavailable("overlay key", response.status);
  return key;
}

export const OVERLAY_GAMES = ["roulette", "gacha", "gacha-board", "quest", "mini"] as const;
export type OverlayGame = (typeof OVERLAY_GAMES)[number];
export const isOverlayGame = (value: unknown): value is OverlayGame => OVERLAY_GAMES.includes(value as OverlayGame);

export type OverlayState =
  | { widget: "roulette"; stage: RouletteStage | null }
  | { widget: "gacha"; stage: GachaStage | null; history: { donor: string; prize: string }[] }
  | { widget: "gacha-board"; rows: GachaBoardView["rows"] }
  | { widget: "quest"; quests: { id: string; title: string; amount: number; endsAt: string; extendedMin: number }[] }
  | { widget: "mini"; lines: MiniLine[] };

export function readOverlay(widget: OverlayGame, data: unknown): OverlayState {
  const b = isRecord(data) ? data : {};
  switch (widget) {
    case "roulette":
      return { widget, stage: readRouletteStage(b.stage) };
    case "gacha":
      return { widget, stage: readGachaStage(b.stage), history: rows(b.history).flatMap((h) => (text(h.prize) ? [{ donor: text(h.donor), prize: text(h.prize) }] : [])) };
    case "gacha-board":
      return {
        widget,
        rows: rows(b.rows).flatMap((r) => (id(r.id) && text(r.prize) ? [{ id: id(r.id)!, donor: text(r.donor), gachaName: text(r.gachaName), prize: text(r.prize), claimed: r.claimed === true }] : []))
      };
    case "quest":
      return {
        widget,
        quests: rows(b.quests).flatMap((q) => (id(q.id) && time(q.endsAt) ? [{ id: id(q.id)!, title: text(q.title), amount: whole(q.amount) ?? 0, endsAt: time(q.endsAt)!, extendedMin: whole(q.extendedMin) ?? 0 }] : []))
      };
    case "mini":
      return {
        widget,
        lines: rows(b.lines).flatMap((l) => (id(l.id) && text(l.text) ? [{ id: id(l.id)!, nickname: text(l.nickname), amount: `${(whole(l.amount) ?? 0).toLocaleString("ko-KR")} FN`, text: text(l.text) }] : []))
      };
  }
}

/** Null for a key FLEXTV does not know (the overlay page answers 404). */
export async function fetchOverlay(key: string, widget: OverlayGame): Promise<OverlayState | null> {
  if (!isOverlayKey(key)) return null;
  const response = await flextvRequest(`/api/ssumnation/overlay/${key}/${widget}`);
  if (response.status === 404) return null;
  if (response.status !== 200) throw unavailable("overlay", response.status);
  return readOverlay(widget, response.data);
}
