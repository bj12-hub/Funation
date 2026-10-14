import type { Metadata } from "next";
import { FilteringTab } from "@/features/creatorStudio/donations/FilteringTab";
import { getBlockedDonors, getFilterSettings } from "@/services/creator/donationManagement";
import styles from "@/features/creatorStudio/donations/donations.module.css";

// Figma 539:466 (필터링) · 539:574 (차단 리스트) — the 후원관리+ 후원 필터링 tab as its own page on the helper domain.
// Its links still name the studio (`/creator/donations?tab=filtering…`); the helper host sends them here.
export const metadata: Metadata = { title: "후원 필터링" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const sub = one(raw.sub) === "block" ? "block" : "filter";
  const [settings, blocked] = await Promise.all([
    sub === "filter" ? getFilterSettings() : Promise.resolve(null),
    sub === "block" ? getBlockedDonors({ query: one(raw.q) ?? "", page: Number(one(raw.page) ?? 1) }) : Promise.resolve(null)
  ]);
  if (!settings && !blocked) return null;
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>후원 필터링</h1>
      </header>
      <FilteringTab sub={sub} settings={settings} blocked={blocked} />
    </div>
  );
}
