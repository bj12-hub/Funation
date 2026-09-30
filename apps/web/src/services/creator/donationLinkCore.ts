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

const g = globalThis as typeof globalThis & { __funationMockDonationLinkV1?: DonationLinkStore };
export const donationLinkStore = (): DonationLinkStore =>
  (g.__funationMockDonationLinkV1 ??= {
    enabled: { YOUTUBE: false, FLEXTV: false, SOOP: false },
    cursors: {},
    seen: {},
    stats: { YOUTUBE: { received: 0, duplicates: 0, lastEventAt: null }, FLEXTV: { received: 0, duplicates: 0, lastEventAt: null }, SOOP: { received: 0, duplicates: 0, lastEventAt: null } },
    recent: [],
    requests: {}
  });
