import type { Platform } from "@/types/platform";
import type { LinkedDonation } from "./donationLinkTypes";

/** Server-only 후원 연동 state (not a "use server" module); shared with the admin platform status page. */
export type DonationLinkStore = {
  enabled: Record<Platform, boolean>;
  cursors: Partial<Record<Platform, string | null>>;
  seen: Record<string, true>;
  stats: Record<Platform, { received: number; duplicates: number; lastEventAt: string | null }>;
  recent: LinkedDonation[];
  requests: Record<string, true>;
};

const ALL: Platform[] = ["YOUTUBE", "CHZZK", "SOOP", "FLEXTV"];
const per = <T>(make: () => T) => Object.fromEntries(ALL.map((p) => [p, make()])) as Record<Platform, T>;

const g = globalThis as typeof globalThis & { __funationMockDonationLinkV2?: DonationLinkStore };
export const donationLinkStore = (): DonationLinkStore =>
  (g.__funationMockDonationLinkV2 ??= {
    enabled: per(() => false),
    cursors: {},
    seen: {},
    stats: per(() => ({ received: 0, duplicates: 0, lastEventAt: null })),
    recent: [],
    requests: {}
  });
