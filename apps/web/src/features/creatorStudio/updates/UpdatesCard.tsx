import Link from "next/link";
import type { UpdatesView } from "@/services/creator/updatesTypes";
import styles from "./updates.module.css";

/** 대시보드 "업데이트 소식" card — code-first (not in Figma 245:14). Latest posts with a NEW mark. */
export function UpdatesCard({ view }: { view: UpdatesView }) {
  return (
    <section className={styles.card} aria-labelledby="dash-updates">
      <div className={styles.cardHead}>
        <h2 id="dash-updates">업데이트 소식</h2>
        <Link href="/creator/updates">전체 ›</Link>
      </div>
      {view.posts.length === 0 ? (
        <p>아직 소식이 없어요.</p>
      ) : (
        <ul className={styles.cardList}>
          {view.posts.map((p) => (
            <li key={p.id}>
              <Link href="/creator/updates">
                {p.unread && <span className={styles.new}>NEW</span>}
                {p.title}
                <time dateTime={p.date}>{p.date.replace(/-/g, ".")}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
