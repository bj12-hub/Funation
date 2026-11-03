import { FlextvUnavailableError } from "@/lib/flextv/client";
import { requestDeviceContext } from "@/lib/flextv/request";
import {
  controlGacha,
  controlRoulette,
  decideQuest,
  extendQuest,
  fetchChannelQuests,
  fetchGachaRemote,
  fetchOverlay,
  fetchOverlayKey,
  fetchRouletteRemote,
  isOverlayGame,
  type GachaAction,
  type RouletteAction
} from "@/lib/flextv/ssumnationBroadcast";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import type { QuestStatus } from "./donationManagementTypes";
import { isQuestAction, isQuestOutcome, QUEST_EXTEND_BOUNDS_TEXT, QUEST_EXTEND_MINUTES, type QuestAction, type QuestDecideResult, type QuestExtendResult, type QuestRemoteView } from "@/services/donations/questTypes";
import type { GachaControlResult, GachaRemoteView } from "@/services/donations/gachaTypes";
import type { RouletteControlResult, RouletteRemoteView } from "@/services/donations/rouletteTypes";
import { DEFAULT_OVERLAY_APPEARANCE, resolveTheme } from "./overlayThemeTypes";
import { studioContext } from "./flextvStudio";
import type { OverlayWidget } from "./widgetOverlayTypes";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

/**
 * 퀘스트 · 리모컨 · OBS overlays of a FLEXTV channel (phase 6, docs/development/flextv-ssumnation-api.md §6–§9), behind
 * the services Ssumnation's screens already call (quests.ts, donationManagement.ts, questRemote.ts, rouletteRemote.ts,
 * gachaRemote.ts, widgetOverlay.ts): with FLEXTV_SSUMNATION_API they delegate here, and the screens work unchanged.
 * FLEXTV keeps the records and the broadcast state; the streamer is always the caller's own channel.
 */

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const record = (input: unknown) => (typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {});
const CONTROL_DOWN = { status: "INVALID", message: "FLEXTV에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." } as const;

async function guarded<T>(call: () => Promise<T>, down: T): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof FlextvUnavailableError) return down;
    throw error;
  }
}

/* ── 퀘스트 ──────────────────────────────────────────────── */

/** What the streamer may decide (the mock's `creatorQuestActions`): 취소 always, 성공 · 실패 with 크리에이터 성공 결정. */
export const creatorActions = (status: string, creatorDecides: boolean): QuestAction[] => (status !== "IN_PROGRESS" ? [] : creatorDecides ? ["SUCCESS", "FAILED", "CANCELED"] : ["CANCELED"]);

/** The supporter decides their own quest (성공 · 실패). */
export async function flextvDecideMyQuest(input: unknown): Promise<QuestDecideResult> {
  const session = await getSession();
  const token = session && (await getFlextvAccessToken());
  if (!session || !token) return { status: "UNAUTHORIZED" };
  const v = record(input);
  if (!isQuestOutcome(v.outcome) || typeof v.id !== "string") return { status: "INVALID" };
  const context = await requestDeviceContext();
  return guarded(() => decideQuest(token, context, v.id as string, v.outcome as "SUCCESS" | "FAILED"), { status: "INVALID" });
}

/** The streamer decides a quest sent to their channel (FLEXTV checks it is theirs and what they may decide). */
export async function flextvDecideReceivedQuest(input: unknown): Promise<QuestDecideResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const v = record(input);
  if (!isQuestAction(v.outcome) || typeof v.id !== "string") return { status: "INVALID" };
  const context = await requestDeviceContext();
  return guarded(() => decideQuest(ctx.token, context, v.id as string, v.outcome as QuestAction), { status: "INVALID" });
}

export const RECEIVED_QUEST_PAGE_SIZE = 10;

export type FlextvQuestRow = {
  id: string;
  createdAt: string;
  decidedAt: string | null;
  donorNickname: string;
  title: string;
  amount: number;
  status: QuestStatus;
  endsAt: string;
  extendedMin: number;
  actions: QuestAction[];
};

export type FlextvQuestPage = { status: QuestStatus | "ALL"; page: number; totalPages: number; total: number; items: FlextvQuestRow[]; held: { amount: number; count: number } };

/** 받은 후원 › 퀘스트 with FLEXTV: the quests sent to the streamer's channel, with what they may decide. */
export async function flextvReceivedQuests({ status, page }: { status: QuestStatus | "ALL"; page: number }): Promise<FlextvQuestPage | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const wanted = Number.isSafeInteger(page) && page >= 1 ? page : 1;
  const read = (p: number) => fetchChannelQuests(ctx.token, { status, offset: (p - 1) * RECEIVED_QUEST_PAGE_SIZE, limit: RECEIVED_QUEST_PAGE_SIZE });
  const first = await read(wanted);
  if (!first) return null;
  const totalPages = Math.max(1, Math.ceil(first.count / RECEIVED_QUEST_PAGE_SIZE));
  const shown = wanted > totalPages ? ((await read(totalPages)) ?? first) : first;
  return {
    status,
    page: Math.min(wanted, totalPages),
    totalPages,
    total: first.count,
    held: first.held,
    items: shown.items.map((q) => ({ ...q, actions: creatorActions(q.status, q.creatorDecides) }))
  };
}

export async function flextvQuestRemote(): Promise<QuestRemoteView | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const page = await fetchChannelQuests(ctx.token, { status: "IN_PROGRESS", offset: 0, limit: 50 });
  if (!page) return null;
  return {
    quests: page.items.map((q) => ({ id: q.id, donor: q.donorNickname, donorId: "", title: q.title, amount: q.amount, createdAt: q.createdAt, endsAt: q.endsAt, extendedMin: q.extendedMin, actions: creatorActions(q.status, q.creatorDecides) })),
    serverNow: page.serverNow,
    allowExtension: page.allowExtension
  };
}

export async function flextvExtendQuest(input: unknown): Promise<QuestExtendResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const v = record(input);
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId) || typeof v.id !== "string") return { status: "INVALID", message: "잘못된 요청입니다." };
  const { minutes } = v;
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < QUEST_EXTEND_MINUTES.min || minutes > QUEST_EXTEND_MINUTES.max) return { status: "INVALID", message: QUEST_EXTEND_BOUNDS_TEXT };
  const context = await requestDeviceContext();
  return guarded(() => extendQuest(ctx.token, context, v.id as string, minutes, v.requestId as string), CONTROL_DOWN);
}

/* ── 룰렛 · 뽑기 ─────────────────────────────────────────── */

export async function flextvRouletteRemote(): Promise<RouletteRemoteView | null> {
  const ctx = await studioContext();
  return ctx ? fetchRouletteRemote(ctx.token) : null;
}

export async function flextvRoulette(action: RouletteAction): Promise<RouletteControlResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const context = await requestDeviceContext();
  return guarded(() => controlRoulette(ctx.token, context, action), CONTROL_DOWN);
}

export async function flextvGachaRemote(): Promise<GachaRemoteView | null> {
  const ctx = await studioContext();
  return ctx ? fetchGachaRemote(ctx.token) : null;
}

export async function flextvGacha(action: GachaAction): Promise<GachaControlResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const context = await requestDeviceContext();
  return guarded(() => controlGacha(ctx.token, context, action), CONTROL_DOWN);
}

/** The id a 리모컨 button sends: one of FLEXTV's (checked again by FLEXTV against the streamer's own records). */
const idOf = (input: unknown, key: string) => {
  const value = record(input)[key];
  return typeof value === "string" && /^[\w-]{1,40}$/.test(value) ? value : null;
};
const BAD_INPUT = { status: "INVALID", message: "요청 정보를 확인해 주세요." } as const;
const SWITCHES = ["enabled", "autoStart", "autoReveal"] as const;

/** The 리모컨's 룰렛 buttons (rouletteRemote.ts) as FLEXTV's actions. */
export function flextvRouletteButton(button: "start" | "pause" | "reveal" | "switch" | "hide" | "finish", input?: unknown): Promise<RouletteControlResult> {
  const v = record(input);
  switch (button) {
    case "start":
      return flextvRoulette({ action: "START_NEXT" });
    case "pause":
      return typeof v.paused === "boolean" ? flextvRoulette({ action: v.paused ? "PAUSE" : "RESUME" }) : Promise.resolve(BAD_INPUT);
    case "hide":
      return typeof v.hidden === "boolean" ? flextvRoulette({ action: v.hidden ? "HIDE" : "SHOW" }) : Promise.resolve(BAD_INPUT);
    case "switch":
      return SWITCHES.includes(v.key as (typeof SWITCHES)[number]) && typeof v.on === "boolean"
        ? flextvRoulette({ action: "SWITCH", key: v.key as (typeof SWITCHES)[number], on: v.on })
        : Promise.resolve(BAD_INPUT);
    default: {
      const spinId = idOf(input, "spinId");
      return spinId ? flextvRoulette({ action: button === "reveal" ? "REVEAL" : "FINISH", spinId }) : Promise.resolve(BAD_INPUT);
    }
  }
}

/** The 리모컨's 뽑기 buttons (gachaRemote.ts) as FLEXTV's actions. */
export function flextvGachaButton(button: "finish" | "hide" | "claim", input: unknown): Promise<GachaControlResult> {
  const v = record(input);
  if (button === "hide") return typeof v.hidden === "boolean" ? flextvGacha({ action: v.hidden ? "HIDE" : "SHOW" }) : Promise.resolve(BAD_INPUT);
  const drawId = idOf(input, "drawId");
  if (!drawId) return Promise.resolve(BAD_INPUT);
  if (button === "finish") return flextvGacha({ action: "FINISH", drawId });
  return typeof v.claimed === "boolean" ? flextvGacha({ action: v.claimed ? "CLAIM" : "UNCLAIM", drawId }) : Promise.resolve(BAD_INPUT);
}

/* ── OBS overlays ────────────────────────────────────────── */

/** The streamer's overlay key from FLEXTV (`reissue`: a new one, the old one stops). */
export async function flextvOverlayKey(reissue = false): Promise<string | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  return fetchOverlayKey(ctx.token, reissue ? await requestDeviceContext() : null, reissue);
}

/**
 * The 룰렛 · 뽑기 · 당첨 리스트 · 퀘스트 · 미니 overlays from FLEXTV's state, drawn with Ssumnation's default look (FLEXTV
 * keeps no overlay design). Every other overlay — and an unknown key — is FORBIDDEN (the page answers 404).
 */
export async function flextvOverlayWidget(widget: unknown, key: unknown): Promise<OverlayWidget | "FORBIDDEN"> {
  if (!isOverlayGame(widget) || typeof key !== "string") return "FORBIDDEN";
  const state = await fetchOverlay(key, widget).catch(() => null);
  if (!state) return "FORBIDDEN";
  const d = DEFAULT_WIDGET_SETTINGS;
  const common = { reloadSeq: 0, on: true, serverNow: new Date().toISOString() };
  const theme = (choice: Parameters<typeof resolveTheme>[1]) => resolveTheme(DEFAULT_OVERLAY_APPEARANCE, choice);
  switch (state.widget) {
    case "roulette":
      return { widget: "roulette", settings: d.ROULETTE, stage: state.stage, ...common, theme: theme(d.ROULETTE.theme) };
    case "gacha":
      return { widget: "gacha", settings: d.GACHA, stage: state.stage, history: state.history.slice(0, d.GACHA.credit.historyCount), ...common, theme: theme(d.GACHA.overlayTheme) };
    case "gacha-board":
      return { widget: "gacha-board", settings: d.GACHA, board: { title: d.GACHA.board.title, speed: d.GACHA.board.speed, rows: state.rows }, ...common, theme: theme(d.GACHA.overlayTheme) };
    case "quest":
      return { widget: "quest", settings: d.QUEST, quests: state.quests.slice(0, d.QUEST.maxCount), ...common, theme: theme(d.QUEST.theme) };
    case "mini":
      return { widget: "mini", settings: d.MINI, lines: state.lines, ...common, theme: theme(d.MINI.theme) };
  }
}
