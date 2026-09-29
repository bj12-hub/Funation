import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationListTab } from "@/features/creatorStudio/donations/DonationListTab";
import { DonorRankingTab } from "@/features/creatorStudio/donations/DonorRankingTab";
import { ManagementShell } from "@/features/creatorStudio/donations/ManagementShell";
import { PageSettingsTab } from "@/features/creatorStudio/donations/PageSettingsTab";
import { getDonationPageSettings, getDonorRanking, getReceivedDonations } from "@/services/creator/donationManagement";
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

// Figma: donation-management 539:7 (후원 페이지 설정) · 539:156 (후원 리스트) · 539:303 (후원 순위)
export const metadata: Metadata = { title: "후원관리+ | Funation 크리에이터" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const LOGIN = "/login?role=creator&next=/creator/donations";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  // 후원 필터링 · 칭호 설정 are not built yet; fall back to the first tab.
  const requested = parseManagementTab(one(raw.tab));
  const tab = requested === "filtering" || requested === "titles" ? "settings" : requested;

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
