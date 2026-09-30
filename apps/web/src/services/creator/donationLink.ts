"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { ADAPTERS, mockYouTubeSuperChat } from "@/services/platforms/adapters";
import type { Platform } from "@/types/platform";
import { enqueueAlert } from "./alertCore";
import { SIM_CURRENCIES, formatMoney, type DonationLinkResult, type DonationLinkView, type LinkedDonation } from "./donationLinkTypes";
import { donationLinkStore } from "./donationLinkCore";
import { youtubeStore } from "./youtubeCore";

/**
 * 후원 연동 Server Actions — code-first. Route `/creator/widgets/link`.
 * Pulls donation events through each platform adapter (DONATION_EVENTS), dedupes them by the platform's
 * event id and queues them as EXTERNAL alerts. Nothing here touches FN, wallets or earnings.
 */

const PLATFORMS: Platform[] = ["YOUTUBE", "FLEXTV", "SOOP"];

const store = donationLinkStore;

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Donation link API is not connected yet.");
};
const supported = (p: Platform) => ADAPTERS[p].capabilities.includes("DONATION_EVENTS");
/** The platform channel the events come from (only YouTube has an account connection in the mock). */
const channelOf = (p: Platform) => (p === "YOUTUBE" ? (youtubeStore().channel?.externalChannelId ?? null) : null);
const isPlatform = (v: unknown): v is Platform => PLATFORMS.includes(v as Platform);

/** Pulls new events for every enabled, connected platform. Re-delivered events are counted, not shown. */
async function ingest() {
  const s = store();
  let ingested = 0;
  let duplicates = 0;
  for (const p of PLATFORMS) {
    const channel = channelOf(p);
    if (!s.enabled[p] || !supported(p) || !channel) continue;
    const { events, cursor } = await ADAPTERS[p].fetchDonationEvents(channel, s.cursors[p] ?? null);
    s.cursors[p] = cursor;
    for (const e of events) {
      const k = `${p}:${e.externalEventId}`;
      if (s.seen[k]) {
        duplicates++;
        s.stats[p].duplicates++;
        continue;
      }
      s.seen[k] = true;
      const amountLabel = formatMoney(e.amount.value, e.amount.currency);
      enqueueAlert({ kind: "EXTERNAL", donor: e.donorName, message: e.message, fnAmount: 0, amountLabel, typeLabel: e.kindLabel });
      s.recent.unshift({ key: k, platform: p, donor: e.donorName, message: e.message, amountLabel, kindLabel: e.kindLabel, receivedAt: new Date().toISOString() });
      s.recent.length = Math.min(s.recent.length, 20);
      s.stats[p].received++;
      s.stats[p].lastEventAt = e.occurredAt;
      ingested++;
    }
  }
  return { ingested, duplicates };
}

export async function getDonationLinks(): Promise<DonationLinkView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await ingest();
  const s = store();
  return structuredClone({
    links: PLATFORMS.map((p) => ({ platform: p, supported: supported(p), connected: !!channelOf(p), enabled: s.enabled[p], ...s.stats[p] })),
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
  // Turning a link on starts from "now": events from before are not replayed as alerts.
  if (v.enabled && !s.enabled[v.platform]) s.cursors[v.platform] = (await ADAPTERS[v.platform].fetchDonationEvents(channelOf(v.platform)!, s.cursors[v.platform] ?? null)).cursor;
  s.enabled[v.platform] = v.enabled;
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
  if (v.platform !== "YOUTUBE") return { status: "INVALID", message: "시뮬레이터는 YouTube 슈퍼챗만 지원해요." };
  const channel = channelOf("YOUTUBE");
  if (!channel) return { status: "INVALID", message: "먼저 유튜브 채널을 연결해 주세요." };
  const donor = typeof v.donor === "string" ? v.donor.trim() : "";
  const message = typeof v.message === "string" ? v.message.trim() : "";
  if (!donor || donor.length > 40) return { status: "INVALID", message: "보낸 사람 이름을 1~40자로 입력해 주세요." };
  if (message.length > 200) return { status: "INVALID", message: "메시지는 200자까지예요." };
  if ([donor, message].some((t) => MOCK_FORBIDDEN_WORDS.some((w) => t.toLowerCase().includes(w)))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!SIM_CURRENCIES.includes(v.currency as never)) return { status: "INVALID", message: "통화를 골라 주세요." };
  if (typeof v.value !== "number" || !Number.isFinite(v.value) || v.value <= 0 || v.value > 10_000_000) return { status: "INVALID", message: "금액을 확인해 주세요." };
  s.requests[v.requestId] = true;
  const event = { id: `yt-sc-${randomUUID()}`, donor, message, value: v.value, currency: v.currency as string };
  mockYouTubeSuperChat(channel, event);
  if (v.redeliver === true) mockYouTubeSuperChat(channel, event);
  return { status: "OK", ...(await ingest()) };
}
