import { formatNumber } from "@/lib/format";

/**
 * Units a donation amount can be in, by stable code (2026-10-08). Codes are what gets stored — 자동엑셀 환산값,
 * 후원 리스트 entries, EXTERNAL alerts — so a code is never renamed; screens show its label, which may change.
 * Platform adapters map each platform's own unit to a code; the core never sees the platform's unit name. Client-safe.
 */
export const UNIT_CODES = ["FN", "KRW", "USD", "JPY", "SOOP_BALLOON", "CHZZK_CHEESE", "FLEXTV_UNIT"] as const;
export type UnitCode = (typeof UNIT_CODES)[number];

/** Korean display label per code. FLEXTV_UNIT: FlexTV's unit name is TBD, so the label is a placeholder. */
export const UNIT_LABEL: Record<UnitCode, string> = {
  FN: "FN",
  KRW: "원",
  USD: "USD",
  JPY: "JPY",
  SOOP_BALLOON: "별풍선",
  CHZZK_CHEESE: "치즈",
  FLEXTV_UNIT: "FlexTV 후원"
};

/** Codes that are ISO 4217 currencies (amounts read as money: ₩5,000 · US$12.50). */
const CURRENCY_CODES: ReadonlySet<UnitCode> = new Set(["KRW", "USD", "JPY"]);

/**
 * The unit of a platform amount: a UnitCode, or another ISO 4217 currency a platform paid in (e.g. a Super Chat in
 * EUR) — shown and summed on its own, but not a 자동엑셀 unit.
 */
export type AmountUnit = UnitCode | (string & NonNullable<unknown>);

/**
 * Keys stored (and sent by older screens) before the codes: the display label. Frozen on purpose — never derive it
 * from UNIT_LABEL, or a later label change would orphan these. FN · KRW · USD · JPY were already codes.
 */
const LEGACY_UNIT_KEYS: Readonly<Record<string, UnitCode>> = { 별풍선: "SOOP_BALLOON", 치즈: "CHZZK_CHEESE", "FlexTV 후원": "FLEXTV_UNIT" };

export const isUnitCode = (v: unknown): v is UnitCode => typeof v === "string" && (UNIT_CODES as readonly string[]).includes(v);

/** The code for a code or a pre-code key (label), or null. For stored data and clients that still send labels. */
export function toUnitCode(v: unknown): UnitCode | null {
  if (isUnitCode(v)) return v;
  return typeof v === "string" && Object.hasOwn(LEGACY_UNIT_KEYS, v) ? LEGACY_UNIT_KEYS[v] : null;
}

/** A currency (listed or not) rather than a platform's own unit or FN. */
export const isCurrencyUnit = (u: AmountUnit) => (isUnitCode(u) ? CURRENCY_CODES.has(u) : true);

/** A unit's name on screen: its label, or the ISO code of a currency outside the list. */
export const unitLabel = (u: AmountUnit) => (isUnitCode(u) ? UNIT_LABEL[u] : u);

/** An amount as screens show it: money for a currency (₩5,000), otherwise number + label (1,000 치즈 · 2,000 FN). */
export function formatUnitAmount(value: number, unit: AmountUnit): string {
  if (isCurrencyUnit(unit)) {
    try {
      return new Intl.NumberFormat("ko-KR", { style: "currency", currency: unit }).format(value);
    } catch {
      // Not an ISO code after all: fall through to the plain form.
    }
  }
  return `${formatNumber(value)} ${unitLabel(unit)}`;
}
