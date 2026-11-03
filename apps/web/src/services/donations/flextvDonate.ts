import { createHash } from "node:crypto";
import { FlextvUnavailableError } from "@/lib/flextv/client";
import {
  fetchActiveStream,
  fetchChannel,
  fetchSignatures,
  fetchVideoSetting,
  isFlextvChannelId,
  postChatMessage,
  sendDonation,
  type FlextvSignature,
  type MediaSetting,
  type SendOutcome,
  type VideoEffect
} from "@/lib/flextv/donation";
import { FLEXTV_SSUMNATION_API } from "@/lib/flextv/mode";
import { requestDeviceContext } from "@/lib/flextv/request";
import {
  NO_SETTINGS,
  fetchDonationSettings,
  isSsumnationType,
  lookupSsumnationDonation,
  sendSsumnationDonation,
  type ChannelDonationSettings,
  type SsumnationOutcome,
  type SsumnationType
} from "@/lib/flextv/ssumnation";
import { fetchBalance, fetchSpends } from "@/lib/flextv/wallet";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import { getMockDonationCatalog, type DonationCatalog, type DonationTypeKey } from "./donationCatalog";
import { parseDetails, type ParsedDetails } from "./donationDetails";
import type { DonationResult } from "./donationTypes";

/**
 * 후원 to a FLEXTV channel (phases 3 and 6, docs/development/flextv-backend.md "3단계" · "6단계"), behind
 * `requestDonation` of ./donate.ts. FLEXTV decides who may donate and moves the 렉스.
 *
 * FLEXTV's own types — 일반 후원 (the message read out as TTS and shown in chat), the channel's signatures and 영상 후원
 * (FLEXTV's YouTube effect, priced by the second as the streamer set it) — go through `POST /api/luv/send`, which has no
 * idempotency and may debit even when it answers with an error, so this keeps Ssumnation's promise of one debit per
 * confirmed donation:
 * - one key ⇒ one send, per member, for 30 minutes on this server;
 * - one send at a time per member (FLEXTV checks the balance and debits in separate steps);
 * - an answer that is not a clear yes or no is settled by FLEXTV's own record: the member's newest sent donation
 *   before and after. Until it can be read the result stays IN_PROGRESS, and the same key asks again.
 *
 * Ssumnation's own types (미니 · 위시리스트 · 그림 · 룰렛 · 뽑기) go to the endpoints FLEXTV adds for Ssumnation
 * (FLEXTV_SSUMNATION_API), which keep the key themselves: an unclear answer is asked again by the key.
 *
 * Every type is checked with Donation Core's rules (./donationDetails.ts) against the channel's catalog as FLEXTV has it
 * at the send. No 익명 · 별명 · 멤버 지정: FLEXTV has none of them.
 */

export const FLEXTV_MESSAGE_MAX = 100;
const MAX_AMOUNT = 100_000_000;

/** The catalog of a FLEXTV channel's room: only what FLEXTV can deliver for this channel. */
export function flextvCatalog(
  signatures: FlextvSignature[],
  { video = null, settings = NO_SETTINGS }: { video?: MediaSetting | null; settings?: ChannelDonationSettings } = {}
): DonationCatalog {
  const base = getMockDonationCatalog();
  const offered = new Set<DonationTypeKey>(["TEXT"]);
  if (signatures.length > 0) offered.add("SIGNATURE");
  if (video?.enabled) offered.add("VIDEO");
  if (settings.mini) offered.add("MINI");
  if (settings.wishlist.length > 0) offered.add("WISHLIST");
  if (settings.drawing) offered.add("DRAWING");
  if (settings.quest) offered.add("QUEST");
  if (settings.roulette) offered.add("ROULETTE");
  if (settings.gacha.length > 0) offered.add("GACHA");
  return {
    types: base.types.filter((t) => offered.has(t.key)).map((t) => ({ ...t, available: true })),
    // FLEXTV takes any whole 렉스 from 1 for 일반 후원; the other minimums are the streamer's.
    minAmount: { TEXT: 1, MINI: settings.mini?.minAmount ?? 1, VIDEO: video?.minAmount ?? 1, AUDIO: 1 },
    maxAmount: { MINI: settings.mini?.maxAmount ?? 1 },
    maxLength: { message: FLEXTV_MESSAGE_MAX, mini: settings.mini?.maxLength ?? base.maxLength.mini },
    // FLEXTV's server drops the voice choice, so none is offered: its default voice reads the message.
    voices: [],
    signatures: signatures.map((s, i) => ({ id: s.code, name: s.name, price: s.amount, imageUrl: s.imageUrl, favorite: false, rank: i + 1 })),
    wishlist: settings.wishlist,
    miniColors: settings.mini?.colors ?? [],
    roulette: settings.roulette ? { enabled: true, ...settings.roulette } : { enabled: false, minAmount: 0, dailyLimit: 0, items: [] },
    gacha: settings.gacha,
    // 그림 · 퀘스트 share the streamer's minimum and title length; the longest 퀘스트 time limit is theirs too.
    game: { minAmount: settings.game.minAmount, maxText: settings.game.maxTitle, maxTimeSec: settings.quest?.maxTimeSec ?? base.game.maxTimeSec },
    ...(video?.enabled ? { mediaPricing: { VIDEO: { perSecond: video.perSecond, maxSec: video.maxSec } } } : {})
  };
}

/** The room's catalog as FLEXTV has it now: for the room page and again at every send. */
export async function loadFlextvCatalog(channelId: string, token: string | null): Promise<DonationCatalog> {
  const [signatures, video, settings] = await Promise.all([
    fetchSignatures(channelId, token).catch(() => []),
    fetchVideoSetting(channelId).catch(() => null),
    FLEXTV_SSUMNATION_API ? fetchDonationSettings(channelId).catch(() => NO_SETTINGS) : Promise.resolve(NO_SETTINGS)
  ]);
  return flextvCatalog(signatures, { video, settings });
}

type Parsed = {
  channelId: string;
  amount: number | null;
  signatureCode: string | null;
  expectedAmount: number | null;
  message: string;
  key: string;
  /** 영상 후원 and Ssumnation's own types: the request as sent, checked against the channel's catalog at the send. */
  other: Record<string, unknown> | null;
};

const cleanMessage = (value: unknown) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : null);

export function parseDonation(input: unknown): Parsed | { invalid: string | null } {
  if (typeof input !== "object" || input === null) return { invalid: null };
  const r = input as Record<string, unknown>;
  if (typeof r.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(r.idempotencyKey)) return { invalid: null };
  if (!isFlextvChannelId(r.creatorId)) return { invalid: null };
  if (r.hideProfile === true) return { invalid: "FLEXTV 채널에는 익명으로 후원할 수 없어요." };
  if ((r.nicknameId ?? null) !== null || (r.memberId ?? null) !== null) return { invalid: null };
  const message = cleanMessage(r.message) ?? "";
  if (message.length > FLEXTV_MESSAGE_MAX) return { invalid: `메시지는 ${FLEXTV_MESSAGE_MAX}자까지 쓸 수 있어요.` };
  const base = { channelId: r.creatorId, message, key: r.idempotencyKey, other: null };
  if (r.type === "TEXT") {
    const amount = r.amount;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) return { invalid: null };
    return { ...base, amount, signatureCode: null, expectedAmount: null };
  }
  if (r.type === "SIGNATURE") {
    if (typeof r.signatureId !== "string" || !r.signatureId || typeof r.expectedAmount !== "number") return { invalid: null };
    return { ...base, amount: null, signatureCode: r.signatureId, expectedAmount: r.expectedAmount };
  }
  if (r.type === "VIDEO" || (FLEXTV_SSUMNATION_API && isSsumnationType(r.type))) return { ...base, amount: null, signatureCode: null, expectedAmount: null, other: r };
  return { invalid: "FLEXTV 채널에서는 아직 지원하지 않는 후원 유형이에요." };
}

/* ── One send per key, one at a time per member ─────────── */

const KEY_TTL_MS = 30 * 60 * 1000;
type Entry = { at: number; fingerprint: string; result: Promise<DonationResult>; reconcile: (() => Promise<DonationResult>) | null };
const g = globalThis as typeof globalThis & { __ssumnationFlextvDonationKeys?: Map<string, Entry>; __ssumnationFlextvDonationQueues?: Map<string, Promise<unknown>> };
const keys = (g.__ssumnationFlextvDonationKeys ??= new Map());
const queues = (g.__ssumnationFlextvDonationQueues ??= new Map());

function serialize<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(userId) ?? Promise.resolve();
  const next = previous.then(task, task);
  const tail = next.catch(() => undefined);
  queues.set(userId, tail);
  void tail.then(() => queues.get(userId) === tail && queues.delete(userId));
  return next;
}

/** What the supporter sent, minus the key (a drawing is large: kept as a digest). */
const fingerprintOf = (p: Parsed) => createHash("sha256").update(JSON.stringify({ ...p, key: undefined, other: p.other && { ...p.other, idempotencyKey: undefined } })).digest("hex");

export async function requestDonation(input: unknown): Promise<DonationResult> {
  const session = await getSession();
  const token = session && (await getFlextvAccessToken());
  if (!session || !token) return { status: "UNAUTHORIZED" };
  const parsed = parseDonation(input);
  if ("invalid" in parsed) return parsed.invalid ? { status: "INVALID", message: parsed.invalid } : { status: "INVALID" };

  const now = Date.now();
  for (const [k, e] of keys) if (now - e.at > KEY_TTL_MS) keys.delete(k);
  const keyOf = `${session.userId}:${parsed.key}`;
  const fingerprint = fingerprintOf(parsed);
  const previous = keys.get(keyOf);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    const result = await previous.result;
    // Unknown last time: FLEXTV's record may tell now.
    if (result.status === "IN_PROGRESS" && previous.reconcile) {
      previous.result = serialize(session.userId, previous.reconcile);
      return previous.result;
    }
    return result;
  }
  const entry: Entry = { at: now, fingerprint, result: Promise.resolve({ status: "IN_PROGRESS" }), reconcile: null };
  keys.set(keyOf, entry);
  entry.result = serialize(session.userId, () => send(token, parsed, entry));
  // Nothing reached FLEXTV's send (a read before it failed): the same key may try again.
  entry.result.catch(() => keys.delete(keyOf));
  return entry.result;
}

async function send(token: string, p: Parsed, entry: Entry): Promise<DonationResult> {
  const channel = await fetchChannel(p.channelId);
  if (!channel) return { status: "NOT_FOUND" };
  if (!channel.owner.verified) return { status: "INVALID", message: RECIPIENT_UNAVAILABLE };

  let amount = p.amount;
  let video: VideoEffect | null = null;
  let other: ParsedDetails | null = null;
  if (p.signatureCode) {
    const signature = (await fetchSignatures(p.channelId, token)).find((s) => s.code === p.signatureCode);
    if (!signature) return { status: "INVALID", message: "이 시그니처는 지금 보낼 수 없어요. 다른 시그니처를 골라 주세요." };
    if (signature.amount !== p.expectedAmount) return { status: "PRICE_CHANGED", amount: signature.amount };
    amount = signature.amount;
  } else if (p.other) {
    // 영상 후원 and Ssumnation's types: Donation Core's rules against the channel's catalog now. FLEXTV applies its own
    // forbidden words to what it shows.
    const catalog = await loadFlextvCatalog(p.channelId, token);
    const checked = parseDetails(p.other, catalog, () => false);
    if (!checked || "refused" in checked) return { status: "INVALID", message: checked ? checked.refused : NOT_OFFERED };
    const price = currentPrice(catalog, checked);
    if (checked.priced && price === null) return { status: "INVALID", message: NOT_OFFERED };
    if (checked.priced && price !== checked.amount) return { status: "PRICE_CHANGED", amount: price! };
    other = checked;
    amount = checked.amount;
    if (checked.type === "VIDEO") video = { url: `https://www.youtube.com/watch?v=${checked.details.videoId as string}`, startSec: checked.details.start as number, endSec: checked.details.end as number };
  }
  const required = amount!;

  const balance = await fetchBalance(token);
  if (balance === null) return { status: "UNAUTHORIZED" };
  if (balance < required) return { status: "INSUFFICIENT_FN", balance, required };

  const context = await requestDeviceContext();
  if (other && isSsumnationType(other.type)) return sendOwnType(token, context, p, other as ParsedDetails & { type: SsumnationType }, { balance, entry });

  const before = (await fetchSpends(token, { offset: 0, limit: 1 })).items[0]?.id ?? null;
  const sentAt = Date.now();
  const settled = () => settle(token, { before, required, balance, sentAt });

  let outcome: SendOutcome;
  try {
    outcome = await sendDonation(token, context, { channelId: p.channelId, amount: required, signatureCode: p.signatureCode, message: video ? "" : p.message, video });
  } catch (error) {
    if (!(error instanceof FlextvUnavailableError)) throw error;
    entry.reconcile = settled;
    return settled().catch((): DonationResult => ({ status: "IN_PROGRESS" }));
  }

  if (outcome.kind === "SENT") {
    if (p.message && !video && channel.live) {
      const stream = await fetchActiveStream(p.channelId).catch(() => null);
      if (stream) await postChatMessage(token, context, { channelId: p.channelId, streamId: stream.streamId, message: p.message });
    }
    const result = await settled().catch((): DonationResult => ({ status: "IN_PROGRESS" }));
    // FLEXTV said yes: if its record is not readable yet, it is still this donation.
    return result.status === "COMPLETED" ? result : { status: "COMPLETED", donationId: `flextv-${p.key}`, fnAmount: required, balance: Math.max(0, balance - required) };
  }
  return refused(outcome, balance, required);
}

/** The creator's price now of a 위시리스트 item or a 뽑기 (null: gone or out of stock). */
function currentPrice(catalog: DonationCatalog, d: ParsedDetails): number | null {
  if (d.type === "WISHLIST") {
    const item = catalog.wishlist.find((w) => w.id === d.details.itemId);
    return item?.inStock ? item.price : null;
  }
  if (d.type === "GACHA") return catalog.gacha.find((x) => x.id === d.details.gachaId)?.price ?? null;
  return d.amount;
}

/* ── Ssumnation's own types (FLEXTV_SSUMNATION_API) ───────── */

async function sendOwnType(
  token: string,
  context: Awaited<ReturnType<typeof requestDeviceContext>>,
  p: Parsed,
  d: ParsedDetails & { type: SsumnationType },
  { balance, entry }: { balance: number; entry: Entry }
): Promise<DonationResult> {
  // The message travels on its own; FLEXTV has no voice choice.
  const details = { ...d.details };
  const message = typeof details.message === "string" ? details.message : "";
  delete details.message;
  delete details.voiceId;
  // A quest's 성공 보상 is the amount itself.
  delete details.successReward;
  const donation = { idempotencyKey: p.key, channelId: p.channelId, type: d.type, amount: d.amount, message, details };
  const ask = async (): Promise<DonationResult> => {
    let outcome: SsumnationOutcome;
    try {
      outcome = await lookupSsumnationDonation(token, p.key);
      // FLEXTV never got it: the same key is safe to send again (FLEXTV keeps one donation per key).
      if (outcome.kind === "NOT_FOUND") outcome = await sendSsumnationDonation(token, context, donation);
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "IN_PROGRESS" };
      throw error;
    }
    return resultOf(outcome, balance, d.amount);
  };
  let outcome: SsumnationOutcome;
  try {
    outcome = await sendSsumnationDonation(token, context, donation);
  } catch (error) {
    if (!(error instanceof FlextvUnavailableError)) throw error;
    entry.reconcile = ask;
    return ask();
  }
  if (outcome.kind === "PROCESSING") entry.reconcile = ask;
  return resultOf(outcome, balance, d.amount);
}

function resultOf(outcome: SsumnationOutcome, balance: number, required: number): DonationResult {
  switch (outcome.kind) {
    case "COMPLETED":
      return { status: "COMPLETED", donationId: `flextv-${outcome.donationId}`, fnAmount: outcome.amount, balance: outcome.balance ?? Math.max(0, balance - outcome.amount) };
    case "PROCESSING":
    case "NOT_FOUND":
      return { status: "IN_PROGRESS" };
    case "INSUFFICIENT":
      return { status: "INSUFFICIENT_FN", balance: outcome.balance ?? balance, required };
    case "PRICE_CHANGED":
      return { status: "PRICE_CHANGED", amount: outcome.amount };
    case "CONFLICT":
      return { status: "CONFLICT" };
    case "UNAUTHORIZED":
      return { status: "UNAUTHORIZED" };
    default:
      return { status: "INVALID", message: outcome.message ?? NOT_SENT };
  }
}

/** How long a send FLEXTV did not answer may still land: until then "no new row" is not yet "not sent". */
export const SETTLE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Whether a donation reached FLEXTV, from its own record: FLEXTV writes the member's donation row together with the
 * debit, so a row newer than `before` with this amount is this donation. No such row: not sent once the window passed,
 * still unknown before. An unreadable record is unknown.
 */
export async function settle(token: string, { before, required, balance, sentAt }: { before: string | null; required: number; balance: number; sentAt: number }): Promise<DonationResult> {
  const page = await fetchSpends(token, { offset: 0, limit: 10 }).catch(() => null);
  if (!page) return { status: "IN_PROGRESS" };
  const newer = before === null ? page.items : page.items.slice(0, Math.max(0, page.items.findIndex((s) => s.id === before)));
  // `before` fell off the first page: more than ten donations since — read as unknown rather than guess.
  if (before !== null && !page.items.some((s) => s.id === before) && page.items.length > 0) return { status: "IN_PROGRESS" };
  const mine = newer.find((s) => s.rex === required);
  if (!mine) return Date.now() - sentAt > SETTLE_WINDOW_MS ? { status: "INVALID", message: NOT_SENT } : { status: "IN_PROGRESS" };
  const after = await fetchBalance(token).catch(() => null);
  return { status: "COMPLETED", donationId: `flextv-${mine.id}`, fnAmount: required, balance: after ?? Math.max(0, balance - required) };
}

const RECIPIENT_UNAVAILABLE = "이 크리에이터는 아직 후원을 받을 수 없어요.";
const NOT_SENT = "후원을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
const NOT_OFFERED = "이 후원은 지금 보낼 수 없어요. 화면을 새로고침해 주세요.";

function refused(outcome: Exclude<SendOutcome, { kind: "SENT" }>, balance: number, required: number): DonationResult {
  switch (outcome.kind) {
    case "INSUFFICIENT":
      return { status: "INSUFFICIENT_FN", balance, required };
    case "IDENTITY_REQUIRED":
      return { status: "INVALID", message: "후원하려면 본인인증이 필요해요. FLEXTV에서 본인인증을 진행해 주세요." };
    case "NOT_ALLOWED":
      return { status: "INVALID", message: "이 계정은 후원할 수 없어요." };
    case "BLOCKED":
      return { status: "INVALID", message: "이 채널에서 후원이 제한된 계정이에요." };
    case "REAUTH_REQUIRED":
      return { status: "INVALID", message: "보안을 위해 FLEXTV에서 비밀번호를 다시 설정한 뒤 후원해 주세요." };
    case "RECIPIENT_UNAVAILABLE":
      return { status: "INVALID", message: RECIPIENT_UNAVAILABLE };
    default:
      return { status: "INVALID", message: NOT_SENT };
  }
}
