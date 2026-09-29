import { SearchLargeIcon } from "@/components/icons";
import type { CreatorsParams } from "./creatorsHref";
import styles from "./creators.module.css";

/**
 * Figma 690:5 creator-search-box.
 * A plain GET form: works without JavaScript and with IME input, and keeps the current category/sort.
 */
export function CreatorSearch({ params }: { params: CreatorsParams }) {
  return (
    <form role="search" action="/creators" className={styles.search}>
      {params.category && <input type="hidden" name="category" value={params.category} />}
      {params.sort && params.sort !== "popular" && <input type="hidden" name="sort" value={params.sort} />}
      <SearchLargeIcon />
      <input
        type="search"
        name="q"
        className={styles.searchInput}
        placeholder="크리에이터 이름, 키워드 검색"
        aria-label="크리에이터 이름, 키워드 검색"
        defaultValue={params.query ?? ""}
        maxLength={50}
      />
    </form>
  );
}
