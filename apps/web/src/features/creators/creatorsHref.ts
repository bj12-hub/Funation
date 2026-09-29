import type { CreatorCategory, CreatorSort } from "@/services/creators/creators";

export type CreatorsParams = {
  category?: CreatorCategory;
  query?: string;
  sort?: CreatorSort;
  page?: number;
};

/** Builds a `/creators` URL; changing a filter resets the page to 1 unless a page is given. */
export function creatorsHref(current: CreatorsParams, next: Partial<CreatorsParams>) {
  const merged: CreatorsParams = { ...current, page: undefined, ...next };
  const params = new URLSearchParams();
  if (merged.category) params.set("category", merged.category);
  if (merged.query) params.set("q", merged.query);
  if (merged.sort && merged.sort !== "popular") params.set("sort", merged.sort);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `/creators?${qs}` : "/creators";
}
