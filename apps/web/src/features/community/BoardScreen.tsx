import Link from "next/link";
import { formatKstDate } from "@/lib/format";
import { BOARD_CATEGORIES, boardEmptyText, categoryLabel, type BoardView } from "@/services/community/communityTypes";
import { CarriedToast } from "../moderation/CarriedToast";
import styles from "./community.module.css";

const date = (iso: string) => formatKstDate(iso, { month: "2-digit", day: "2-digit" });

/** 커뮤니티 목록 — code-first (no Figma frame). Route `/community` (`?category=` `?q=` `?page=`). */
export function BoardScreen({ view, signedIn }: { view: BoardView; signedIn: boolean }) {
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ category: view.category, q: view.q, page: String(view.page), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "category" && v === "ALL") || (k === "page" && v === "1")) p.delete(k);
    const s = p.toString();
    return `/community${s ? `?${s}` : ""}`;
  };
  const empty = boardEmptyText(view.q);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>커뮤니티</h1>
          <p className={styles.subtitle}>전체 게시글 {view.total}개</p>
        </div>
        <Link href={signedIn ? "/community/new" : "/login?next=/community/new"} className={styles.primary}>
          글쓰기
        </Link>
      </header>
      {/* 차단 from a post's page comes back here with its toast. */}
      <CarriedToast />

      <nav className={styles.tabs} aria-label="분류">
        {[{ key: "ALL", label: "전체" }, ...BOARD_CATEGORIES].map((c) => (
          <Link key={c.key} href={href({ category: c.key, page: "1" })} className={styles.tab} aria-current={view.category === c.key ? "page" : undefined}>
            {c.label}
          </Link>
        ))}
      </nav>

      <form action="/community" className={styles.search} role="search">
        {view.category !== "ALL" && <input type="hidden" name="category" value={view.category} />}
        <input name="q" defaultValue={view.q} placeholder="제목 또는 내용 검색" aria-label="게시글 검색" maxLength={40} className={styles.input} />
        <button type="submit" className={styles.ghost}>
          검색
        </button>
      </form>

      {view.items.length === 0 ? (
        <div className={styles.empty}>
          <strong>{empty.title}</strong>
          <span>{empty.hint}</span>
        </div>
      ) : (
        <ul className={styles.list}>
          {view.items.map((p) => (
            <li key={p.id}>
              <Link href={`/community/${p.id}`} className={styles.row}>
                <span className={styles.chip}>{categoryLabel(p.category)}</span>
                <span className={styles.rowTitle}>
                  {p.title}
                  {p.commentCount > 0 && <span className={styles.comments}> [{p.commentCount}]</span>}
                </span>
                <span className={styles.meta}>
                  {p.authorName} · {date(p.createdAt)} · 조회 {p.views}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {view.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="페이지">
          {Array.from({ length: view.totalPages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: String(n) })} className={styles.page} aria-current={n === view.page ? "page" : undefined}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
