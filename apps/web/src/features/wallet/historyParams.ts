import { parsePeriod, type Period } from "@/lib/period";
import { DONATION_CATEGORY_LABEL, DONATION_QUERY_MAX, type DonationCategory, type DonationFilter } from "@/services/wallet/walletTypes";

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

/** 후원 내역 search filters: `q` `min` `max` `sort` (invalid values are dropped). */
export function parseDonationFilter(raw: RawParams): DonationFilter {
  const amount = (v: string | undefined) => {
    const n = Number(v);
    return v && Number.isInteger(n) && n >= 0 && n <= 999_999_999 ? n : undefined;
  };
  const q = one(raw.q)?.trim().slice(0, DONATION_QUERY_MAX) || undefined;
  return { q, min: amount(one(raw.min)), max: amount(one(raw.max)), sort: one(raw.sort) === "oldest" ? "oldest" : undefined };
}

/** Query string for a period (+ optional category / page / 후원 filter); defaults are omitted. */
export function historyQuery({ period, category, page, filter }: { period: Period; category?: DonationCategory; page?: number; filter?: DonationFilter }) {
  const params = new URLSearchParams();
  if (filter?.q) params.set("q", filter.q);
  if (filter?.min !== undefined) params.set("min", String(filter.min));
  if (filter?.max !== undefined) params.set("max", String(filter.max));
  if (filter?.sort === "oldest") params.set("sort", "oldest");
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
