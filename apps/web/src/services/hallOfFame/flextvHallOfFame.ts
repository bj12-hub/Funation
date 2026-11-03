import { fetchHallOfFame, hallOfFameMonths, type HallOfFameRow } from "@/lib/flextv/events";
import { kstParts } from "@/lib/format";

/**
 * 명예의 전당 with FLEXTV (phase 9, docs/development/flextv-backend.md "9단계"): FLEXTV's monthly 명예의 전당 — its top
 * supporters by 후원 점수, with their accumulated badges — from January 2026 to this month. Route `/hall-of-fame`
 * (`?month=YYYYMM`). Server-only read.
 */

export type FlextvHallOfFameView = { month: string; months: string[]; rows: HallOfFameRow[] };

export async function getFlextvHallOfFame(month: unknown): Promise<FlextvHallOfFameView> {
  const now = kstParts(new Date());
  const months = hallOfFameMonths(`${now.year}${String(now.month).padStart(2, "0")}`);
  const selected = typeof month === "string" && months.includes(month) ? month : months[0];
  return { month: selected, months, rows: selected ? await fetchHallOfFame(selected) : [] };
}
