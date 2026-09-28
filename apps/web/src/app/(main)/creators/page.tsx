import type { Metadata } from "next";
import { CreatorsScreen, type CreatorsParams } from "@/features/creators";
import { CREATOR_CATEGORY_LABEL, CREATOR_SORT_LABEL, getCreators, type CreatorCategory, type CreatorSort } from "@/services/creators/creators";

// Figma: funation-all-creators-page 690:5
export const metadata: Metadata = { title: "인기 크리에이터 | Funation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function parseParams(raw: Record<string, string | string[] | undefined>): CreatorsParams {
  const category = one(raw.category);
  const sort = one(raw.sort);
  const page = Number(one(raw.page));
  return {
    category: category && category in CREATOR_CATEGORY_LABEL ? (category as CreatorCategory) : undefined,
    sort: sort && sort in CREATOR_SORT_LABEL ? (sort as CreatorSort) : undefined,
    query: one(raw.q)?.trim().slice(0, 50) || undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined
  };
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = parseParams(await searchParams);
  const data = await getCreators(params);
  return <CreatorsScreen data={data} params={{ ...params, page: data.page }} />;
}
