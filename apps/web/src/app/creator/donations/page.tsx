import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationListTab } from "@/features/creatorStudio/donations/DonationListTab";
import { DonorRankingTab } from "@/features/creatorStudio/donations/DonorRankingTab";
import { FilteringTab } from "@/features/creatorStudio/donations/FilteringTab";
import { ManagementShell } from "@/features/creatorStudio/donations/ManagementShell";
import { PageSettingsTab } from "@/features/creatorStudio/donations/PageSettingsTab";
import { TitlesTab } from "@/features/creatorStudio/donations/TitlesTab";
import {
  getBlockedDonors,
  getDonationPageSettings,
  getDonorRanking,
  getFilterSettings,
  getReceivedDonations,
  getTitleTiers
} from "@/services/creator/donationManagement";
import {
  LIST_KINDS,
  QUEST_STATUSES,
  RANK_PERIODS,
  parseListPeriod,
  parseManagementTab,
  type ListKind,
  type RankPeriod,
  type StatusFilter
} from "@/services/creator/donationManagementTypes";

// Figma: donation-management 539:7 (후원 페이지 설정) · 539:156 (후원 리스트) · 539:303 (후원 순위) ·
// 539:466 / 539:574 (후원 필터링 · 차단 리스트) · 539:690 (칭호 설정)
export const metadata: Metadata = { title: "후원관리+ | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const LOGIN = "/login?role=creator&next=/creator/donations";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = parseManagementTab(one(raw.tab));

  if (tab === "filtering") {
    const sub = one(raw.sub) === "block" ? "block" : "filter";
    const [settings, blocked] = await Promise.all([
      sub === "filter" ? getFilterSettings() : Promise.resolve(null),
      sub === "block" ? getBlockedDonors({ query: one(raw.q) ?? "", page: Number(one(raw.page) ?? 1) }) : Promise.resolve(null)
    ]);
    if (!settings && !blocked) redirect(LOGIN);
    return (
      <ManagementShell tab="filtering">
        <FilteringTab sub={sub} settings={settings} blocked={blocked} />
      </ManagementShell>
    );
  }

  if (tab === "titles") {
    const tiers = await getTitleTiers();
    if (!tiers) redirect(LOGIN);
    return (
      <ManagementShell tab="titles">
        <TitlesTab initial={tiers} />
      </ManagementShell>
    );
  }

  if (tab === "list") {
    const kindRaw = one(raw.kind);
    const statusRaw = one(raw.status);
    const data = await getReceivedDonations({
      kind: LIST_KINDS.some((k) => k.key === kindRaw) ? (kindRaw as ListKind) : "quest",
      period: parseListPeriod({ period: one(raw.period), from: one(raw.from), to: one(raw.to), year: one(raw.year) }),
      status: QUEST_STATUSES.some((s) => s.key === statusRaw) ? (statusRaw as StatusFilter) : "ALL",
      query: one(raw.q) ?? "",
      page: Number(one(raw.page) ?? 1)
    });
    if (!data) redirect(LOGIN);
    return (
      <ManagementShell tab="list">
        <DonationListTab data={data} />
      </ManagementShell>
    );
  }

  if (tab === "ranking") {
    const p = one(raw.period);
    const data = await getDonorRanking(RANK_PERIODS.some((x) => x.key === p) ? (p as RankPeriod) : "month");
    if (!data) redirect(LOGIN);
    return (
      <ManagementShell tab="ranking">
        <DonorRankingTab data={data} />
      </ManagementShell>
    );
  }

  const settings = await getDonationPageSettings();
  if (!settings) redirect(LOGIN);
  return (
    <ManagementShell tab="settings">
      <PageSettingsTab initial={settings} />
    </ManagementShell>
  );
}
