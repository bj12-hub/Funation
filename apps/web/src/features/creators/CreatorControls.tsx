"use client";

import { useRouter } from "next/navigation";
import { ChevronDownSmallIcon } from "@/components/icons";
import { CREATOR_SORT_LABEL, type CreatorSort } from "@/services/creators/creators";
import { creatorsHref, type CreatorsParams } from "./creatorsHref";
import styles from "./creators.module.css";

/** Figma 690:5 sort pill ("시청자 많은 순 ⌄"). Other options are TBD. */
export function CreatorSortSelect({ params }: { params: CreatorsParams }) {
  const router = useRouter();

  return (
    <label className={styles.sort}>
      <select
        className={styles.sortSelect}
        aria-label="정렬"
        value={params.sort ?? "viewers"}
        onChange={(e) => router.push(creatorsHref(params, { sort: e.target.value as CreatorSort }))}
      >
        {(Object.keys(CREATOR_SORT_LABEL) as CreatorSort[]).map((s) => (
          <option key={s} value={s}>
            {CREATOR_SORT_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDownSmallIcon className={styles.sortIcon} />
    </label>
  );
}
