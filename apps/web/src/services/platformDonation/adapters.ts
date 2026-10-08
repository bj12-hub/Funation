import { randomBytes } from "node:crypto";
import type { PlatformCreator, PlatformKey, PlatformProduct } from "./platformTypes";

/**
 * PlatformAdapter (CLAUDE.md §9): one adapter per external platform, each mapping its own DTOs to
 * Ssumnation's core types. These are development mocks — neither SOOP nor FlexTV API access, auth,
 * rate limits nor the ability to send 별풍선/하트 on a user's behalf is confirmed (TBD). The mock
 * DTO shapes below are deliberately different per platform so the mapping stays explicit.
 */

export type SendResult = { ok: true; externalTransactionId: string } | { ok: false; reason: "API_ERROR" | "UNAVAILABLE" | "TIMEOUT" };

export interface PlatformAdapter {
  readonly platform: PlatformKey;
  searchCreators(query: string): Promise<PlatformCreator[]>;
  getCreator(id: string): Promise<PlatformCreator | null>;
  listProducts(creatorId: string): Promise<PlatformProduct[]>;
  popularCreators(): Promise<PlatformCreator[]>;
  sendDonation(req: { creatorId: string; productId: string; amountFn: number; message: string; idempotencyKey: string }): Promise<SendResult>;
}

const hex = (n: number) => randomBytes(n).toString("hex").toUpperCase();
const yymmdd = () => {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};
const matches = (q: string, ...fields: string[]) => fields.some((f) => f.toLowerCase().includes(q.toLowerCase()));

// ── SOOP (mock DTOs: bj_id / bj_nick / broad_no …) ─────────────────────────────

type SoopBj = {
  bj_id: string;
  bj_nick: string;
  is_live: boolean;
  broad_title: string;
  last_broad_note: string;
  viewer_cnt: number | null;
  color: string;
  popular: boolean;
  /** Dev-only outcome so the error states (817:9618) can be exercised. */
  mock_outcome?: "API_ERROR";
};

const SOOP_BJS: SoopBj[] = [
  { bj_id: "kim_stream", bj_nick: "김스트리머", is_live: true, broad_title: "오늘은 다이아 도전! 같이 달려요", last_broad_note: "", viewer_cnt: 3842, color: "#18c6d8", popular: false },
  { bj_id: "gameking", bj_nick: "게임왕", is_live: false, broad_title: "", last_broad_note: "마지막 방송: 2일 전", viewer_cnt: null, color: "#8b5cf6", popular: false, mock_outcome: "API_ERROR" },
  { bj_id: "bangbang", bj_nick: "방방송송", is_live: true, broad_title: "지금 라이브 방송 중", last_broad_note: "", viewer_cnt: 1210, color: "#fb7185", popular: true },
  { bj_id: "todaylive", bj_nick: "오늘도라이브", is_live: true, broad_title: "지금 라이브 방송 중", last_broad_note: "", viewer_cnt: 860, color: "#f5bf0a", popular: true }
];

/** 별풍선 bundles as priced in Figma 817:9242 (1개 = 1,000 FN in the sample — rate TBD). */
const SOOP_BALLOONS = [10, 30, 50, 100];

const soopToCreator = (b: SoopBj): PlatformCreator => ({
  id: b.bj_id,
  nickname: b.bj_nick,
  handle: `@${b.bj_id}`,
  live: b.is_live,
  statusText: b.is_live ? b.broad_title : b.last_broad_note,
  viewers: b.is_live ? b.viewer_cnt : null,
  avatarColor: b.color
});

export const soopAdapter: PlatformAdapter = {
  platform: "SOOP",
  async searchCreators(q) {
    return SOOP_BJS.filter((b) => matches(q, b.bj_nick, b.bj_id)).map(soopToCreator);
  },
  async getCreator(id) {
    const b = SOOP_BJS.find((x) => x.bj_id === id);
    return b ? soopToCreator(b) : null;
  },
  async popularCreators() {
    return SOOP_BJS.filter((b) => b.popular).map(soopToCreator);
  },
  async listProducts() {
    return SOOP_BALLOONS.map((n) => ({ id: `balloon-${n}`, label: `별풍선 ${n}개`, priceFn: n * 1000, icon: "⭐" }));
  },
  async sendDonation({ creatorId }) {
    const b = SOOP_BJS.find((x) => x.bj_id === creatorId);
    if (!b) return { ok: false, reason: "UNAVAILABLE" };
    if (b.mock_outcome) return { ok: false, reason: b.mock_outcome };
    return { ok: true, externalTransactionId: `SP-${yymmdd()}-${hex(3)}` };
  }
};

// ── FlexTV (mock DTOs: hostId / hostName / onAir …) ───────────────────────────

type FlexHost = {
  hostId: string;
  hostName: string;
  onAir: boolean;
  title: string;
  lastLive: string;
  watching: number | null;
  tint: string;
  featured: boolean;
  /** Dev-only outcome so the error state (817:8948) can be exercised. */
  mockOutcome?: "API_ERROR";
};

const FLEX_HOSTS: FlexHost[] = [
  { hostId: "flexman_live", hostName: "플렉스맨", onAir: true, title: "오늘 밤 신곡 공개! 같이 즐겨요", lastLive: "", watching: 3842, tint: "#ff5b75", featured: true },
  { hostId: "heartfairy", hostName: "하트요정", onAir: true, title: "지금 라이브 방송 중", lastLive: "", watching: 920, tint: "#f472b6", featured: true, mockOutcome: "API_ERROR" },
  { hostId: "todaylive_flex", hostName: "오늘도라이브", onAir: false, title: "", lastLive: "마지막 방송: 2일 전", watching: null, tint: "#f5bf0a", featured: false },
  { hostId: "musicon", hostName: "뮤직온", onAir: true, title: "지금 라이브 방송 중", lastLive: "", watching: 540, tint: "#4a90e2", featured: false }
];

/** 응원 상품 of Figma 817:8597 (sample prices, TBD). 직접 입력 bounds are sample values (TBD). */
const FLEX_ITEMS: PlatformProduct[] = [
  { id: "heart", label: "하트", priceFn: 1_000, icon: "♡" },
  { id: "cheer", label: "응원", priceFn: 5_000, icon: "✦" },
  { id: "clap", label: "박수", priceFn: 10_000, icon: "👏" },
  { id: "jackpot", label: "대박", priceFn: 50_000, icon: "★" },
  { id: "custom", label: "직접 입력", priceFn: null, icon: "＋", custom: { minFn: 1_000, maxFn: 1_000_000 } }
];

const flexToCreator = (h: FlexHost): PlatformCreator => ({
  id: h.hostId,
  nickname: h.hostName,
  handle: `@${h.hostId}`,
  live: h.onAir,
  statusText: h.onAir ? h.title : h.lastLive,
  viewers: h.onAir ? h.watching : null,
  avatarColor: h.tint
});

export const flexTvAdapter: PlatformAdapter = {
  platform: "FLEXTV",
  async searchCreators(q) {
    return FLEX_HOSTS.filter((h) => matches(q, h.hostName, h.hostId)).map(flexToCreator);
  },
  async getCreator(id) {
    const h = FLEX_HOSTS.find((x) => x.hostId === id);
    return h ? flexToCreator(h) : null;
  },
  async popularCreators() {
    return FLEX_HOSTS.filter((h) => h.featured).map(flexToCreator);
  },
  async listProducts() {
    return FLEX_ITEMS.map((p) => ({ ...p }));
  },
  async sendDonation({ creatorId }) {
    const h = FLEX_HOSTS.find((x) => x.hostId === creatorId);
    if (!h) return { ok: false, reason: "UNAVAILABLE" };
    if (h.mockOutcome) return { ok: false, reason: h.mockOutcome };
    return { ok: true, externalTransactionId: `FT-${yymmdd()}-${hex(3)}` };
  }
};

export const adapterFor = (platform: PlatformKey): PlatformAdapter => (platform === "SOOP" ? soopAdapter : flexTvAdapter);
