import type { MessageKey } from "@/lib/i18n/translate";
import type { HistoryPeriod, HistorySort, HistoryStatus, PlatformKey } from "@/services/platformDonation/platformTypes";

/**
 * Message keys for the per-platform words in PLATFORMS (스트리머 · 호스트, tagline, search placeholder) and the 후원 내역
 * labels, so the screens follow the viewer's language (2026-11-01). `who` · `whos`: the word in a sentence (Korean has
 * one form; English singular · plural); `label`: on its own (a field label).
 */
export const PLATFORM_WORDS: Record<PlatformKey, { who: MessageKey; whos: MessageKey; label: MessageKey; tagline: MessageKey; search: MessageKey }> = {
  SOOP: {
    who: "platformDonation.whoSoop",
    whos: "platformDonation.whosSoop",
    label: "platformDonation.labelSoop",
    tagline: "platformDonation.taglineSoop",
    search: "platformDonation.searchSoop"
  },
  FLEXTV: {
    who: "platformDonation.whoFlextv",
    whos: "platformDonation.whosFlextv",
    label: "platformDonation.labelFlextv",
    tagline: "platformDonation.taglineFlextv",
    search: "platformDonation.searchFlextv"
  }
};

export const HISTORY_STATUS_KEY: Record<HistoryStatus, MessageKey> = {
  COMPLETED: "platformDonation.statusCompleted",
  PROCESSING: "platformDonation.statusProcessing",
  FAILED: "platformDonation.statusFailed",
  REFUNDING: "platformDonation.statusRefunding",
  REFUNDED: "platformDonation.statusRefunded"
};

export const HISTORY_PERIOD_KEY: Record<HistoryPeriod, MessageKey> = {
  "30": "platformDonation.period30",
  "90": "platformDonation.period90",
  all: "platformDonation.periodAll"
};

export const HISTORY_SORT_KEY: Record<HistorySort, MessageKey> = {
  newest: "platformDonation.sortNewest",
  oldest: "platformDonation.sortOldest"
};
