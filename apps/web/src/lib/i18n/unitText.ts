import { isUnitCode, unitLabel, type AmountUnit, type UnitCode } from "@/types/donationUnit";
import type { MessageKey } from "./translate";

const KEYS: Partial<Record<UnitCode, MessageKey>> = {
  KRW: "common.unitKrw",
  SOOP_BALLOON: "common.unitSoopBalloon",
  CHZZK_CHEESE: "common.unitChzzkCheese",
  FLEXTV_UNIT: "common.unitFlextv"
};

/**
 * A donation unit's name in the viewer's language for the studio (2026-11-01): 원 reads KRW and 별풍선 · 치즈 read Star
 * balloons · Cheese in English. FN · USD · JPY and other currencies read the same. OBS overlays keep `unitLabel`.
 */
export function unitText(unit: AmountUnit, t: (key: MessageKey) => string) {
  const key = isUnitCode(unit) ? KEYS[unit] : undefined;
  return key ? t(key) : unitLabel(unit);
}
