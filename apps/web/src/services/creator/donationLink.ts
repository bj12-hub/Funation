"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { broadcastChannelId } from "@/services/broadcast/channelsCore";
import { ADAPTERS, BROADCAST_PLATFORMS, mockYouTubeSuperChat } from "@/services/platforms/adapters";
import { mockPlatformDonation, nextRemoteSeq } from "@/services/platforms/mockBroadcastRemote";
import type { Platform } from "@/types/platform";
import { SIM_CURRENCIES, type DonationLinkResult, type DonationLinkView } from "./donationLinkTypes";
import { donationEventsSupported, donationLinkStore, ingestDonationLinks } from "./donationLinkCore";

/**
 * 후원 연동 Server Actions — code-first. Route `/creator/widgets/link`.
 * Pulls donation events through each platform adapter (DONATION_EVENTS), dedupes them by the platform's
 * event id and queues them as EXTERNAL alerts (and, during a crew broadcast, 후원 리스트 entries for the
 * 자동엑셀). Nothing here touches FN, wallets or earnings.
 */

const PLATFORMS: Platform[] = BROADCAST_PLATFORMS;

const store = donationLinkStore;

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Donation link API is not connected yet.");
};
const supported = donationEventsSupported;
/** The platform channel the events come from (유튜브 연동 or 통합 채팅 › 채널 연결). */
const channelOf = broadcastChannelId;
const isPlatform = (v: unknown): v is Platform => PLATFORMS.includes(v as Platform);
const ingest = ingestDonationLinks;

export async function getDonationLinks(): Promise<DonationLinkView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await ingest();
  const s = store();
  return structuredClone({
    links: PLATFORMS.map((p) => ({
      platform: p,
      supported: supported(p),
      // Declared by the mock adapter, not yet confirmed against the platform's real API (shown as 「API 확인 중」).
      unverified: ADAPTERS[p].unverified.includes("DONATION_EVENTS"),
      connected: !!channelOf(p),
      enabled: s.enabled[p],
      ...s.stats[p]
    })),
    recent: s.recent
  });
}

export async function setDonationLink(input: unknown): Promise<DonationLinkResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isPlatform(v.platform) || typeof v.enabled !== "boolean") return { status: "INVALID", message: "잘못된 요청입니다." };
  if (v.enabled && !supported(v.platform)) return { status: "INVALID", message: "이 플랫폼의 후원 이벤트 연동은 아직 지원하지 않아요." };
  if (v.enabled && !channelOf(v.platform)) return { status: "INVALID", message: "먼저 플랫폼 채널을 연결해 주세요." };
  const s = store();
  const p = v.platform;
  if (!v.enabled || s.enabled[p]) {
    s.enabled[p] = v.enabled;
    return { status: "OK" };
  }
  // Turning a link on starts from "now": events from before are not replayed as alerts. Without a cursor
  // the next read only takes the current position; a failure there (shown on the row) leaves it to the next poll.
  delete s.cursors[p];
  s.stats[p].lastError = null;
  s.enabled[p] = true;
  await ingest(p);
  return { status: "OK" };
}

/** Pull now (the real backend would receive webhooks or poll on a schedule — TBD). */
export async function pollDonationLinks(): Promise<DonationLinkResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return { status: "OK", ...(await ingest()) };
}

/**
 * Developer simulator: a paid chat "arrives" on the platform. `redeliver` sends the same event id twice,
 * the way platforms may retry, to show that only one alert appears.
 */
export async function simulateExternalDonation(input: unknown): Promise<DonationLinkResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const s = store();
  if (s.requests[v.requestId]) return { status: "OK", ingested: 0, duplicates: 0 };
  if (!isPlatform(v.platform) || !supported(v.platform)) return { status: "INVALID", message: "이 플랫폼의 후원 이벤트는 아직 지원하지 않아요." };
  const platform = v.platform;
  const channel = channelOf(platform);
  if (!channel) return { status: "INVALID", message: "먼저 플랫폼 채널을 연결해 주세요." };
  const donor = typeof v.donor === "string" ? v.donor.trim() : "";
  const message = typeof v.message === "string" ? v.message.trim() : "";
  if (!donor || donor.length > 40) return { status: "INVALID", message: "보낸 사람 이름을 1~40자로 입력해 주세요." };
  if (message.length > 200) return { status: "INVALID", message: "메시지는 200자까지예요." };
  if ([donor, message].some((t) => MOCK_FORBIDDEN_WORDS.some((w) => t.toLowerCase().includes(w)))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  // Only YouTube super chats carry a currency; the other platforms use their own units (치즈 · 별풍선 · TBD).
  if (platform === "YOUTUBE" && !SIM_CURRENCIES.includes(v.currency as never)) return { status: "INVALID", message: "통화를 골라 주세요." };
  if (typeof v.value !== "number" || !Number.isFinite(v.value) || v.value <= 0 || v.value > 10_000_000) return { status: "INVALID", message: "금액을 확인해 주세요." };
  if (platform !== "YOUTUBE" && !Number.isInteger(v.value)) return { status: "INVALID", message: "개수는 정수로 입력해 주세요." };
  s.requests[v.requestId] = true;
  const times = v.redeliver === true ? 2 : 1;
  if (platform === "YOUTUBE") {
    const event = { id: `yt-sc-${randomUUID()}`, donor, message, value: v.value, currency: v.currency as string };
    for (let i = 0; i < times; i++) mockYouTubeSuperChat(channel, event);
  } else {
    // From the mock remote's sequence: unique, and numeric so SOOP balloon numbers stay exact. One id for
    // both deliveries when `redeliver` is set.
    const event = { id: `${platform.toLowerCase()}-${nextRemoteSeq()}`, userId: `sim:${donor}`, nick: donor, amount: v.value, message };
    for (let i = 0; i < times; i++) mockPlatformDonation(platform, channel, event);
  }
  return { status: "OK", ...(await ingest()) };
}
