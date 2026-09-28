import { parsePeriod, type Period } from "@/lib/period";
import { DONATION_CATEGORY_LABEL, type DonationCategory } from "@/services/wallet/walletTypes";

/** URL params for `/wallet/charges` and `/wallet/donations`: `period` `from` `to` `page` (+ `type`). */
export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseHistoryParams(raw: RawParams) {
  const page = Number(one(raw.page));
  const type = one(raw.type);
  return {
    period: parsePeriod({ period: one(raw.period), from: one(raw.from), to: one(raw.to) }),
    page: Number.isInteger(page) && page > 1 ? page : 1,
    category: (type && type in DONATION_CATEGORY_LABEL ? type : "basic") as DonationCategory
  };
}

/** Query string for a period (+ optional category / page); defaults are omitted. */
export function historyQuery({ period, category, page }: { period: Period; category?: DonationCategory; page?: number }) {
  const params = new URLSearchParams();
  if (category && category !== "basic") params.set("type", category);
  if (period.preset !== "month") params.set("period", period.preset);
  if (period.preset === "range") {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
