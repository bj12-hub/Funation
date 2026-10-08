import { broadcastChannelId } from "@/services/broadcast/channelsCore";
import { recordBroadcastExternal } from "@/services/crew/crewCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { ADAPTERS, BROADCAST_PLATFORMS, withTimeout } from "@/services/platforms/adapters";
import { PlatformError, type ChannelCursor, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { formatUnitAmount } from "@/types/donationUnit";
import type { Platform } from "@/types/platform";
import { enqueueAlert } from "./alertCore";
import type { LinkedDonation } from "./donationLinkTypes";

/**
 * Server-only 후원 연동 state and ingest (not a "use server" module); shared with the 후원 연동 actions, the
 * alert overlay read and the admin platform status page.
 */
export type DonationLinkStore = {
  enabled: Record<Platform, boolean>;
  /** Tied to the channel it was read from; none (or another channel's) = start from "now". */
  cursors: Partial<Record<Platform, ChannelCursor>>;
  seen: Record<string, true>;
  stats: Record<Platform, { received: number; duplicates: number; skipped: number; lastEventAt: string | null; lastError: PlatformErrorCode | null }>;
  recent: LinkedDonation[];
  requests: Record<string, true>;
  /** Last ingest (epoch ms), for the throttled read from the alert overlay. */
  lastIngestAt: number;
};

const ALL: Platform[] = BROADCAST_PLATFORMS;
const per = <T>(make: () => T) => Object.fromEntries(ALL.map((p) => [p, make()])) as Record<Platform, T>;

const g = globalThis as typeof globalThis & { __funationMockDonationLinkV3?: DonationLinkStore };
export const donationLinkStore = (): DonationLinkStore =>
  (g.__funationMockDonationLinkV3 ??= {
    enabled: per(() => false),
    cursors: {},
    seen: {},
    stats: per(() => ({ received: 0, duplicates: 0, skipped: 0, lastEventAt: null, lastError: null })),
    recent: [],
    requests: {},
    lastIngestAt: 0
  });

export const donationEventsSupported = (p: Platform) => ADAPTERS[p].capabilities.includes("DONATION_EVENTS");
const codeOf = (e: unknown): PlatformErrorCode => (e instanceof PlatformError ? e.code : "UNAVAILABLE");

/**
 * Pulls new events for the enabled, connected platforms (all by default). Platforms are read in parallel,
 * each bounded by a timeout and isolated: one failing, hanging or sending malformed events never blocks
 * the others (or the rest of the 후원 연동 screen); its error shows on its row. With no cursor for the
 * connected channel the read only sets the cursor ("start from now"). Re-delivered events are counted, not shown.
 */
export async function ingestDonationLinks(only?: Platform): Promise<{ ingested: number; duplicates: number }> {
  const s = donationLinkStore();
  s.lastIngestAt = Date.now();
  const reads = await Promise.all(
    ALL.filter((p) => !only || p === only).map(async (p) => {
      const channel = broadcastChannelId(p);
      if (!s.enabled[p] || !donationEventsSupported(p) || !channel) return null;
      const entry = s.cursors[p];
      const fromNow = entry?.channelId !== channel;
      try {
        return { p, channel, fromNow, ...(await withTimeout(ADAPTERS[p].fetchDonationEvents(channel, fromNow ? null : entry.cursor))) };
      } catch (e) {
        if (s.enabled[p] && broadcastChannelId(p) === channel) s.stats[p].lastError = codeOf(e);
        return null;
      }
    })
  );
  let ingested = 0;
  let duplicates = 0;
  // Applied in platform order with no await in between, so the alert queue order is deterministic.
  for (const r of reads) {
    if (!r) continue;
    const { p } = r;
    // Switched off or moved to another channel while we waited: the answer is stale.
    if (!s.enabled[p] || broadcastChannelId(p) !== r.channel) continue;
    s.cursors[p] = { channelId: r.channel, cursor: r.cursor };
    s.stats[p].lastError = null;
    if (r.fromNow) continue;
    s.stats[p].skipped += r.skipped;
    for (const e of r.events) {
      const k = `${p}:${e.externalEventId}`;
      if (s.seen[k]) {
        duplicates++;
        s.stats[p].duplicates++;
        continue;
      }
      s.seen[k] = true;
      // The unit is a code (mapped by the adapter); screens read its label ("1,000 치즈", "₩5,000").
      const amountLabel = formatUnitAmount(e.amount.value, e.amount.unit);
      enqueueAlert({ kind: "EXTERNAL", donor: e.donorName, message: e.message, fnAmount: 0, amountLabel, typeLabel: e.kindLabel, platform: p, native: e.amount });
      // 자동엑셀: a live crew broadcast also lists it in its own unit (scored after conversion).
      recordBroadcastExternal(STUDIO_CHANNEL, { platform: p, donor: e.donorName, message: e.message, value: e.amount.value, unit: e.amount.unit });
      s.recent.unshift({ key: k, platform: p, donor: e.donorName, message: e.message, amountLabel, kindLabel: e.kindLabel, receivedAt: new Date().toISOString() });
      s.recent.length = Math.min(s.recent.length, 20);
      s.stats[p].received++;
      s.stats[p].lastEventAt = e.occurredAt;
      ingested++;
    }
  }
  return { ingested, duplicates };
}

/**
 * The alert overlay (OBS) polls often, so it pulls platform events at most this often. Mock transport only:
 * the real backend receives them through each platform's live connection (TBD), not on overlay reads.
 */
const OVERLAY_INGEST_GAP_MS = 2_000;

export async function ingestDonationLinksThrottled() {
  if (Date.now() - donationLinkStore().lastIngestAt < OVERLAY_INGEST_GAP_MS) return;
  await ingestDonationLinks();
}
