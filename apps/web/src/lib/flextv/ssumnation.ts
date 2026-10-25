import type { MiniColor, WishlistItem } from "@/services/donations/donationCatalog";
import type { GachaOffer, MyGachaDraw, RoomGacha } from "@/services/donations/gachaTypes";
import type { MyRouletteSpin, RoomRoulette } from "@/services/donations/rouletteTypes";
import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";

/**
 * The endpoints FLEXTV adds for Ssumnation's own donation types (phase 6, front first): the contract is
 * docs/development/flextv-ssumnation-api.md, and every reader here follows it. Until FLEXTV serves them
 * (`FLEXTV_SSUMNATION_API=on`), nothing calls them. The `read*` and `map*` functions are pure and tested in
 * `ssumnation.test.ts`.
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const posInt = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const id = (value: unknown) => (typeof value === "string" && /^[\w-]{1,40}$/.test(value) ? value : null);
const rows = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);

/* ── The channel's settings ──────────────────────────────── */

export type ChannelDonationSettings = {
  mini: { minAmount: number; maxAmount: number; maxLength: number; colors: MiniColor[] } | null;
  wishlist: WishlistItem[];
  drawing: { minAmount: number; maxTitle: number } | null;
  roulette: { minAmount: number; dailyLimit: number; items: { name: string; percent: number }[] } | null;
  gacha: GachaOffer[];
};

export const NO_SETTINGS: ChannelDonationSettings = { mini: null, wishlist: [], drawing: null, roulette: null, gacha: [] };

/** `GET /api/ssumnation/channels/:channelId/donation-settings`: what the streamer turned on. Anything malformed is off. */
export function readDonationSettings(data: unknown): ChannelDonationSettings {
  if (!isRecord(data)) return NO_SETTINGS;
  const mini = isRecord(data.mini) && data.mini.enabled === true ? data.mini : null;
  const miniColors = rows(mini?.colors).flatMap((c): MiniColor[] => {
    const colorId = id(c.id);
    return colorId && typeof c.hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(c.hex) ? [{ id: colorId, label: text(c.label) || colorId, hex: c.hex }] : [];
  });
  const miniMin = posInt(mini?.minAmount);
  const miniMax = posInt(mini?.maxAmount);
  const drawing = isRecord(data.drawing) && data.drawing.enabled === true ? data.drawing : null;
  const roulette = isRecord(data.roulette) && data.roulette.enabled === true ? data.roulette : null;
  const items = rows(roulette?.items).flatMap((i) => (text(i.name).trim() && (num(i.percent) ?? 0) > 0 ? [{ name: text(i.name).trim(), percent: num(i.percent)! }] : []));
  // A wheel adds up to 100%: anything else is not a wheel the room can show.
  const wheelOk = items.length >= 2 && Math.abs(items.reduce((s, i) => s + i.percent, 0) - 100) < 0.01;
  return {
    mini: mini && miniMin !== null && miniMax !== null && miniMax >= miniMin && miniColors.length > 0 ? { minAmount: miniMin, maxAmount: miniMax, maxLength: posInt(mini.maxLength) ?? 30, colors: miniColors } : null,
    wishlist: rows(data.wishlist).flatMap((w): WishlistItem[] => {
      const itemId = id(w.id);
      const price = posInt(w.price);
      return itemId && price !== null && text(w.name).trim() ? [{ id: itemId, emoji: text(w.emoji) || "🎁", name: text(w.name).trim(), price, note: text(w.note), inStock: w.inStock !== false }] : [];
    }),
    drawing: drawing && posInt(drawing.minAmount) !== null ? { minAmount: posInt(drawing.minAmount)!, maxTitle: posInt(drawing.maxTitle) ?? 50 } : null,
    roulette: roulette && posInt(roulette.minAmount) !== null && wheelOk ? { minAmount: posInt(roulette.minAmount)!, dailyLimit: Math.max(0, num(roulette.dailyLimit) ?? 0), items } : null,
    gacha: rows(data.gacha).flatMap((g): GachaOffer[] => {
      const gachaId = id(g.id);
      const price = posInt(g.price);
      const mode = g.mode === "STOCK" ? "STOCK" : g.mode === "PROBABILITY" ? "PROBABILITY" : null;
      const prizes = rows(g.prizes).flatMap((p) => (text(p.name).trim() ? [{ name: text(p.name).trim(), blank: p.blank === true, percent: num(p.percent), left: num(p.left) }] : []));
      if (!gachaId || price === null || !mode || prizes.length === 0 || !text(g.name).trim()) return [];
      return [{ id: gachaId, name: text(g.name).trim(), price, mode, prizes, limit: posInt(g.limit), soldOut: g.soldOut === true }];
    })
  };
}

export async function fetchDonationSettings(channelId: string): Promise<ChannelDonationSettings> {
  const response = await flextvRequest(`/api/ssumnation/channels/${encodeURIComponent(channelId)}/donation-settings`);
  if (response.status === 404) return NO_SETTINGS;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV donation settings answered ${response.status}`);
  return readDonationSettings(response.data);
}

/* ── A donation ──────────────────────────────────────────── */

export const SSUMNATION_TYPES = ["MINI", "WISHLIST", "DRAWING", "ROULETTE", "GACHA"] as const;
export type SsumnationType = (typeof SSUMNATION_TYPES)[number];
export const isSsumnationType = (value: unknown): value is SsumnationType => SSUMNATION_TYPES.includes(value as SsumnationType);

export type SsumnationDonation = {
  idempotencyKey: string;
  channelId: string;
  type: SsumnationType;
  /** The 렉스 to debit: for 위시리스트 · 뽑기 the price the supporter confirmed (FLEXTV refuses another price). */
  amount: number;
  message: string;
  details: Record<string, unknown>;
};

export type SsumnationOutcome =
  | { kind: "COMPLETED"; donationId: string; amount: number; balance: number | null }
  /** FLEXTV took the key and is still working on it: ask again with the same key. */
  | { kind: "PROCESSING" }
  /** Lookup only: FLEXTV never received this key. */
  | { kind: "NOT_FOUND" }
  | { kind: "INSUFFICIENT"; balance: number | null }
  | { kind: "PRICE_CHANGED"; amount: number }
  /** FLEXTV refused before debiting (its checks, a limit, sold out), with its message for the member when it sent one. */
  | { kind: "REFUSED"; message: string | null }
  /** The key was used for another donation. */
  | { kind: "CONFLICT" }
  | { kind: "UNAUTHORIZED" };

/** The answers of `POST /api/ssumnation/donations` and `GET …/donations/:key` (the contract's `status`). */
export function mapSsumnation({ status, data }: Pick<FlextvResponse, "status" | "data">): SsumnationOutcome {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 409) return { kind: "CONFLICT" };
  if (status >= 500 || !isRecord(data)) throw new FlextvUnavailableError(`FLEXTV Ssumnation donation answered ${status}`);
  const message = typeof data.message === "string" && data.message.length <= 100 && /[가-힣]/.test(data.message) ? data.message : null;
  switch (data.status) {
    case "COMPLETED": {
      const donationId = typeof data.donationId === "string" || typeof data.donationId === "number" ? String(data.donationId) : null;
      const amount = posInt(data.amount);
      if (!donationId || amount === null) throw new FlextvUnavailableError("FLEXTV answered COMPLETED without the donation");
      return { kind: "COMPLETED", donationId, amount, balance: num(data.balance) };
    }
    case "PROCESSING":
      return { kind: "PROCESSING" };
    case "NOT_FOUND":
      return { kind: "NOT_FOUND" };
    case "INSUFFICIENT":
      return { kind: "INSUFFICIENT", balance: num(data.balance) };
    case "PRICE_CHANGED": {
      const amount = posInt(data.amount);
      return amount === null ? { kind: "REFUSED", message } : { kind: "PRICE_CHANGED", amount };
    }
    case "CONFLICT":
      return { kind: "CONFLICT" };
    case "INVALID":
    case "NOT_ALLOWED":
    case "LIMIT_REACHED":
    case "SOLD_OUT":
      return { kind: "REFUSED", message };
    default:
      throw new FlextvUnavailableError(`FLEXTV Ssumnation donation answered status ${String(data.status)}`);
  }
}

export async function sendSsumnationDonation(token: string, context: DeviceContext, donation: SsumnationDonation): Promise<SsumnationOutcome> {
  return mapSsumnation(
    await flextvRequest("/api/ssumnation/donations", {
      method: "POST",
      token,
      ...requestFrom(context),
      body: { ...donation, channelId: Number(donation.channelId) }
    })
  );
}

/** What FLEXTV did with a key: the same answer the first request got. */
export async function lookupSsumnationDonation(token: string, idempotencyKey: string): Promise<SsumnationOutcome> {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(idempotencyKey)) throw new Error("Not an idempotency key.");
  return mapSsumnation(await flextvRequest(`/api/ssumnation/donations/${idempotencyKey}`, { token }));
}

/* ── The room's 룰렛 · 뽑기 panels ───────────────────────── */

const SPIN_STATUSES = ["QUEUED", "SPINNING", "WAITING", "RESULT", "DONE"] as const;
const DRAW_STATUSES = ["QUEUED", "SPINNING", "RESULT", "DONE"] as const;

/**
 * `GET /api/ssumnation/channels/:channelId/games`: counts for everyone and, with the member's token, their own spins and
 * draws — in the shapes of Ssumnation's 룰렛 · 뽑기 panels (rouletteTypes.ts · gachaTypes.ts). A result appears only
 * once it is revealed on the broadcast.
 */
export function readGames(data: unknown, signedIn: boolean): { roulette: RoomRoulette; gacha: RoomGacha } {
  const body = isRecord(data) ? data : {};
  const r = isRecord(body.roulette) ? body.roulette : {};
  const g = isRecord(body.gacha) ? body.gacha : {};
  const spins = rows(r.mine).flatMap((s): MyRouletteSpin[] => {
    const spinId = id(s.id);
    const status = SPIN_STATUSES.find((x) => x === s.status);
    if (!spinId || !status || typeof s.createdAt !== "string") return [];
    return [{ id: spinId, no: text(s.no) || spinId, amount: posInt(s.amount) ?? 0, createdAt: s.createdAt, status, position: posInt(s.position), result: status === "RESULT" || status === "DONE" ? text(s.result) || null : null }];
  });
  const draws = rows(g.mine).flatMap((d): MyGachaDraw[] => {
    const drawId = id(d.id);
    const status = DRAW_STATUSES.find((x) => x === d.status);
    if (!drawId || !status || typeof d.createdAt !== "string") return [];
    const shown = status === "RESULT" || status === "DONE";
    return [
      {
        id: drawId,
        no: text(d.no) || drawId,
        gachaId: text(d.gachaId),
        gachaName: text(d.gachaName),
        amount: posInt(d.amount) ?? 0,
        createdAt: d.createdAt,
        status,
        position: posInt(d.position),
        prize: shown ? text(d.prize) || null : null,
        blank: shown && typeof d.blank === "boolean" ? d.blank : null
      }
    ];
  });
  const used = isRecord(g.usedToday) ? Object.fromEntries(Object.entries(g.usedToday).flatMap(([k, v]) => (id(k) && num(v) !== null ? [[k, num(v)!]] : []))) : {};
  return {
    roulette: { waiting: Math.max(0, num(r.waiting) ?? 0), participantsToday: Math.max(0, num(r.participantsToday) ?? 0), usedToday: signedIn ? Math.max(0, num(r.usedToday) ?? 0) : null, mine: signedIn ? spins : [] },
    gacha: { waiting: Math.max(0, num(g.waiting) ?? 0), usedToday: signedIn ? used : null, mine: signedIn ? draws : [] }
  };
}

export async function fetchGames(channelId: string, token: string | null) {
  const response = await flextvRequest(`/api/ssumnation/channels/${encodeURIComponent(channelId)}/games`, token ? { token } : {});
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV games answered ${response.status}`);
  return readGames(response.data, token !== null);
}
